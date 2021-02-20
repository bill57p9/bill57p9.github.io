// traccar.js
// Supports Traccar server

// Bill token kdykjYlAsAzZEAFP51ohGGqSbrZUlpAs

// Adaptation
const TRACCAR_retry_startup = 250; 	// At startup check every 250ms for connect
const TRACCAR_retry_reconnect = 5000; // On disconnect, reconnect after 5 s
const TRACCAR_endDate_default = '2100-01-01T00:00:00';

// Return a JSON date format string
function jsonDate(date)
{
	switch(typeof(date))
	{
		case 'object':
			return JSON.stringify(date).substr(1,24);
		default:
			return date;
	}
}

// TRACCAR_TRACKER onject - inherits from TRACKER object
function TRACCAR_TRACKER(id)
{
	this.id = id;
	this.message	= new Array();
}
TRACCAR_TRACKER.prototype				= new TRACKER();
TRACCAR_TRACKER.prototype.constructor = TRACCAR_TRACKER;

// TRACCAR_MESSAGE represents a single TRACCAR message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function TRACCAR_MESSAGE(message)
{
	const timestamp = function(timeString)
	{
		return new Date(new String(timeString).replace("+0000","Z"));
	}
	this.id				= message.id;
	// For SAFARI date must have trailing Z instead of +0000
	this.time			= timestamp(message.fixTime);
	this.timeSvr	= timestamp(message.serverTime);
	this.timeTkr	= timestamp(message.deviceTime);
	this.latitude	= message.latitude;
	this.longitude= message.longitude;
	this.altitude	= message.altitude;
	this.battery	= new String(message.attributes.batteryLevel).concat("%");
}
TRACCAR_MESSAGE.prototype = new TRACKER_MESSAGE();
TRACCAR_MESSAGE.prototype.constructor = TRACCAR_MESSAGE;

// TRACCAR_API
function TRACCAR_API(uri, callback)
{
	console.log(uri);
	this.ajax		= new XMLHttpRequest();

	// Set up callback
	this.ajax.onreadystatechange = function()
	{
		if (this.readyState == 4 && this.status == 200 && callback)
		{
			const data = JSON.parse(this.responseText);
			console.log(data);
			callback(data);
		}
	}

	this.ajax.open('GET', uri, true);
	this.ajax.send();
}
TRACCAR_API.prototype.constructor = TRACCAR_API;

// TRACCAR_FEED object - inherits from FEED object
function TRACCAR_FEED(feedId)
{
	const feed = this;
	this.type		= "traccar";
	this.session= false;
	// id is url;token;deviceID[;deviceID[...]]
	this.id 	  = decodeURI(feedId);
	var devices	= this.id.split(';');
	this.url		= devices.shift()+'/api/';	// First element
	this.token	= devices.shift(); // Second element
	// this.devices is now an array of deviceIDs
	devices.forEach((id)=>
	{
		this.tracker.push(new TRACCAR_TRACKER(id));
	});

	this.ws_url = '';

	// cors-anywhere sorts out any CORS & HTTP/HTTPS issues
	const detect_protocol = function(uri)
	{
		const protocols = [ 'http:', 'https:' ];
		protocols.forEach((protocol) =>
		{
			const prefix = protocol.concat('//');

			// Check whether left part of protocol matches
			if(prefix == uri.substr(0,prefix.length))
				return protocol;
		})
		return false;
	}
	const protocol = detect_protocol(this.url);
	if(protocol)
		this.url = protocol.concat('cors-anywhere.herokuapp.com/', this.url, '//');
	else
	{
		// Indicates a relative path, so websocket URL will need to be reconsituted
		this.ws_url = location.protocol.replace('http','ws').concat
		(
			'//',
			location.hostname
		);
		// Now append port, if applicable
		if(location.port)
			this.ws_url = this.ws_url.concat(':', location.port);

		// ws_url now holds the protocol, server & (if applicable port)
		// If first character of traccar URL is / then absolute path on server - simples
		if('/' == this.url.substr(0,1))
			this.ws_url = this.ws_url.concat(this.url, 'socket');
		else
		{
			// We need to work out the full path
			// Load the traccar & tracker paths into Arrays
			var pathTraccar = this.url.split('/');
			var pathTracker = location.pathname.split('/');

			// Take off the last Tracker element as it will be page name
			pathTracker.pop();
			// And keep doing it if we have parent (..) URI
			while('..' == pathTraccar[0])
			{
				pathTracker.pop();
				pathTraccar.shift();
			}

			// Now we can add the paths
			this.ws_url = this.ws_url.concat
			(
				'/',
				pathTracker.join('/'),
				pathTraccar.join('/'),
				'socket'
			)
		}

	}

	const processDevices = function(devices)
	{
		devices.forEach((device)=>
		{
			// Missing devices will be null
			if(device)
			{
				var tracker = feed.getTracker(device.id);
				console.log(tracker);
				if(tracker)
				{
					tracker.name = device.name;
					tracker.type = device.model;
					tracker.status= device.status;
					tracker.contact	= device.contact;
					tracker.lastUpdate=device.lastUpdate;
				}
			}
		});
	}

	// Function to return a deviceIdQueryString
	this.deviceIdQueryString = function(queryString='deviceId')
	{
		var deviceIdQueryString = "";
		this.tracker.forEach((tracker)=>
		{
			deviceIdQueryString = deviceIdQueryString.concat('&',queryString,'=',tracker.id);
		});
		return deviceIdQueryString;
	}

	// Get feed name & set up session cookie
	new TRACCAR_API
	(
		this.url.concat('session?token=', this.token),
		function(session)
		{
			// Get tracker details
			new TRACCAR_API
			(
				feed.url.concat('devices?id=0', feed.deviceIdQueryString('id')),
				// Returns an array of devices
				processDevices
			)
			feed.name = session.name;
			feed.session= true;	// Mark that we have established a session
		}
	)

	this.getFeedMessages = function(startDate, endDate, callback)
	{
		// Close websocket if endDate not null and has previously been established
		if(feed.ws && !(null === endDate))
		{
			switch(feed.ws.readyState)
			{
				case 0:
				case 1:
					feed.ws.close();
			}
		}

		// Need to wait until session has been established
		if(!feed.session)
			window.setTimeout(function(){feed.getFeedMessages(startDate, endDate, callback)}, 250)
		else
		{
			const processMessages = function(messages)
			{
				messages.forEach((message) =>
				{
					if(message.valid)
					{
						var device = feed.getTracker(message.deviceId);
						if(device)
							device.message.push(new TRACCAR_MESSAGE(message));
					}
				});
				if(callback)
					callback(feed);
			}

			const setFeedStatus = function(status)
			{
				feed.status = status
				if(callback)
					callback(feed);
			}

			// Send query
			new TRACCAR_API
			(
				feed.url.concat
				(
					'reports/route',
					'?from=', jsonDate(startDate),
					'&to='	, jsonDate(null === endDate ? new Date(TRACCAR_endDate_default) : endDate),
					//'?token=', this.token,
					feed.deviceIdQueryString('deviceId')
				),
				function(messages)
				{
					// Set up websocket, if endTime is null
					// We do this before processing the messages to avoid the callback
					if(null === endDate && !feed.ws)
					{
						console.log('Starting WebSocket ', feed.ws_url);
						feed.ws = new WebSocket(feed.ws_url);

						// Set feed status on connect
						feed.ws.onopen = function(event)
						{
							console.log('WebSocket connected');
							setFeedStatus('live');
						}

						// Set feed status on disconnect
						feed.ws.onclose = function(event)
						{
							console.log('WebSocket disconnected');
							setFeedStatus('-');
							// TODO: Reconnect
						}

						// Set feed status on disconnect
						feed.ws.onerror = function(event)
						{
							console.error('WebSocket Error: ', event);
							setFeedStatus('error');
						}

						// Rx message event
						feed.ws.onmessage = function (rx)
						{
							const message = JSON.parse(rx.data);
							console.log(message);

							if(message.positions)
								processMessages(message.positions);
						}
					}

					// responseText will be a JSON array of messages
					processMessages(messages);
				}
			);
		}
	}

}
TRACCAR_FEED.prototype = new FEED();
TRACCAR_FEED.prototype.constructor = TRACCAR_FEED;
TRACCAR_FEED.prototype.type		= "traccar";

// Register provider
FEEDS.addProvider("traccar", TRACCAR_FEED);



// vim: ts=2:sw=2
