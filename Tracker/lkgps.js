// lkgps.js
// Supports LKGPS type feeds by DeviceID (1 tracker per feed)
// This includes 

// LKGPS_API - Used for handling the AJAX requests
function LKGPS_API(baseURL)
{
	this.baseURL	= baseURL;
	this.ajax		= new XMLHttpRequest();
}
LKGPS_API.prototype.constructor = LKGPS_API;
LKGPS_API.prototype.get = function(params, callbackFn, callbackObj)
	{
		// Set up callback
		this.ajax.onreadystatechange = function()
		{
			if (this.readyState == 4 && this.status == 200)
			{
				var parser = new DOMParser();
				callbackFn(JSON.parse(parser.parseFromString(this.responseText, "text/xml").childNodes[0].textContent), callbackObj);				
			}
		};

		// Set full URL
		// cors-anywhere sorts out the CORS & HTTP/HTTPS issues
		var url = "https://cors-anywhere.herokuapp.com/" + this.baseURL + "&Key=7DU2DJFDR8321"
		if(params)
			url = url + "&" + params
		this.ajax.open("GET", url, true );
		console.log(url);
		this.ajax.send();
	};
LKGPS_API.prototype.parse = function()
{
	if(	  4 == this.ajax.readyState
	&& 	200 == this.ajax.status)
		return JSON.parse(new DOMParser().parseFromString(this.ajax.responseText, "text/xml").childNodes[0].textContent);
	return null;
}
	
// LKGPS_MESSAGE represents a single LKGPS message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function LKGPS_MESSAGE(message)
{
	this.id		= message.id ? message.id : 0;
	this.time	= message.pt ? new Date(message.pt + "+0000") : new Date(message.positionTime + "+0000");
	this.latitude=message.lat;
	this.longitude=message.lng;
}
LKGPS_MESSAGE.prototype = new TRACKER_MESSAGE();
LKGPS_MESSAGE.prototype.constructor = LKGPS_MESSAGE;


// LKGPS_TRACKER is a type of TRACKER
function LKGPS_TRACKER(host, deviceID)
{
	var uri			= host + "/openapiv3.asmx/";
	this.id			= deviceID;
	if(this.id)
	{
		this.ApiDevInfo	= new LKGPS_API(uri + "GetDeviceDetail?TimeZones=&DeviceID=" + deviceID);
		this.ApiDevInfo.get(null, function (json, tracker)
		{
			tracker.name	= json.username ? json.username : json.name ;
			tracker.type	= json.type;
			tracker.ApiStatus = new LKGPS_API(uri + "GetTracking?Model=" + json.model + "&Timezones=&MapType=Google&Language=&DeviceID=" + deviceID);
			tracker.ApiStatus.get(null, function(json, tracker) { tracker.ApiCallback(); }, tracker);
		}, this);
		this.ApiAlarms	= new LKGPS_API(uri + "GetWarnList?TimeZones=&Language=en&PageCount=999&PageNo=1&TypeID=1&ID=" + deviceID);
		this.ApiTrack	= new LKGPS_API(uri + "GetDevicesHistory?TimeZones=&MapType=Google&ShowLBS=0&SelectCount=99999&DeviceID=" + deviceID);
		this.message	= new Array();
	}
}
LKGPS_TRACKER.prototype				= new TRACKER();
LKGPS_TRACKER.prototype.constructor = LKGPS_TRACKER;
LKGPS_TRACKER.prototype.latestMessage	= null;
LKGPS_TRACKER.prototype.ApiWait		= 0;	// Used to track how many outstanding API calls we have

// Handle update callbacks
LKGPS_TRACKER.prototype.ApiCallback	= function()
{
	// Only continue if all 3 are READY
	if(		!this.ApiStatus )
		return false;
	if(	4 != this.ApiStatus.ajax.readyState
	||	4 != this.ApiTrack.ajax.readyState
	||	4 != this.ApiAlarms.ajax.readyState )
		return false;
	
	var feed	= FEEDS.getFeed('LKGPS', this.id);
	var status	= this.ApiStatus.parse();
	var	track	= this.ApiTrack.parse();
	var alarms	= this.ApiAlarms.parse();
	var tracker	= this;

	if(track.devices)
	{
		console.log(track);
		// Read messages & latestMessage marker
		track.devices.forEach(function(message)
		{
			tracker.message.push(new LKGPS_MESSAGE(message));
			if(message.time < feed.earliestMessage)
				feed.earliestMessage = new Date(message.time);
			if(message.time > feed.latestMessage)
				feed.latestMessage = new Date(message.time);
		});
		tracker.latestMessage = new Date(track.lastDeviceUtcDate + "+0000");		
	}
	if(status)
	{
		console.log(status);
		// Split status message and check credibility
		// Expected: n-Batteryx%
		// where n in 1, 2 or 3 for MOVE, STOP, OFFLINE
		var aStatus = status.status.split("-");
		if (2 == aStatus.length)
		{
			var iStatus = ["Moving", "Stopped", "Offline"]
			if (0 < aStatus[0] && 4 > aStatus[0])
				tracker.status = iStatus[aStatus[0]-1];
			if (0 == aStatus[1].lastIndexOf("Battery"))
			{
				// Add battery level to latest message
				tracker.message.forEach(function(message)
				{
					if(message.time == feed.latestMessage)
						message.battery	= aStatus[1].substr(7);
				});
			}
		}
	}
	if(alarms.arr)
		alarms.arr.forEach(function (alarm)
		{
			var message = new TRACKER_MESSAGE();	// Note generic message
			message.time = new Date(alarm.deviceDate +"+0000");
			message.type = alarm.warn;
			message.id	 = alarm.id;
				
			// Check to see whether we already have this message
			if(!tracker.message.find(function (msg)
			{
				return (msg.id == message.id && !msg.isTrack()) ? true : false;
			}))
			{
				// Strip out trailing " Alarm"
				if(message.type.search(" Alarm"))
					message.type = message.type.substr(0,message.type.search(" Alarm"));
				
				// Only add it to messages if within the time scope of the track
				if(	message.time >= feed.earliestMessage &&
					message.time <= feed.latestMessage )
					tracker.message.push(message);
			}
		});
	
	// Final Callback
	if(this.updateCallback)
		this.updateCallback(feed);
}

LKGPS_TRACKER.prototype.getTrack	= function(startDate, endDate, callback)
{
	// Default start is 0300L this morning
	if(!startDate)
	{
		startDate = new Date("2017-08-20 00:00:00");
		// Subtract a day for anything prior to 0500L
		if(startDate.getHours() < 5)
			startDate.setTime(startDate.getTime() - (24 * 60 * 60 * 1000));
		startDate.setMilliseconds(0);
		startDate.setSeconds(0);
		startDate.setMinutes(0);
		startDate.setHours(3);
	}

	// This default will give the latest data
	if(!endDate)
		endDate	= new Date("2100-01-01T00:00:00");

	//this.ApiTrack.onSuccess = callback;
	this.ApiTrack.get("StartTime=" + startDate.toJSON().substr(0,19) + "&EndTime=" + endDate.toJSON().substr(0,19), callback, this);
};
LKGPS_TRACKER.prototype.getMessages		= function(startDate, endDate, callback)
{
	// Record callback
	this.updateCallback = callback;
	
	// Launch API calls
	this.getTrack(startDate, endDate, function(json, tracker)
	{	tracker.ApiCallback();	}, this);
	this.ApiAlarms.get(null, function(json, tracker)
	{	tracker.ApiCallback();	}, this);
	if(this.ApiStatus)
		this.ApiStatus.get(null, function(json, tracker)
		{	tracker.ApiCallback();	}, this);
};


// LK-GPS_FEED object - inherits from FEED object
function LKGPS_FEED(id)
{
	if(id)
	{
		this.id		= id;
		this.tracker.push(new LKGPS_TRACKER(this.host, this.id));
		
		// For some reason we get all the LKGPS_TRACKERs on all the LKGPS_FEEDs
		// so filter on tracker ID
		this.tracker = this.tracker.filter(function(tracker)
		{
			return (tracker.id == id);
		});
	}
}
LKGPS_FEED.prototype = new FEED();
LKGPS_FEED.prototype.constructor = LKGPS_FEED;
LKGPS_FEED.prototype.type		= "LKGPS";
LKGPS_FEED.prototype.host		= "http://www.lkgps.net:8080";


// ZG666GPS is a derivative of LKGPS: Same API, etc
function ZG666_FEED() {}
ZG666_FEED.prototype				= new LKGPS_FEED();
ZG666_FEED.prototype.constructor	= LKGPS_FEED;
ZG666_FEED.prototype.host			= "http://211.162.69.241:8088/openapiv3.asmx";
ZG666_FEED.prototype.type			= "ZG666";

// ZG888GPS is a derivative of LKGPS: Same API, etc
function ZG888_FEED() {}
ZG888_FEED.prototype				= new LKGPS_FEED();
ZG888_FEED.prototype.constructor	= LKGPS_FEED;
ZG888_FEED.prototype.host			= "http://app.zg002gps.com/OpenAPIV3.asmx";
ZG888_FEED.prototype.type			= "ZG888";

// Register providers
FEEDS.addProvider("LKGPS", LKGPS_FEED);
FEEDS.addProvider("ZG666", ZG666_FEED);
FEEDS.addProvider("ZG888", ZG888_FEED);



// vim: ts=2:sw=2
