// lkgps.js
// Supports LKGPS type feeds by DeviceID (1 tracker per feed)

// LKGPS_API - inherits from XMLHttpRequest
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
		var url = "https://cors-anywhere.herokuapp.com/" + this.baseURL + "&Key=7DU2DJFDR8321"
		if(params)
			url = url + "&" + params
		this.ajax.open("GET", url, true );
		console.log(url);
		this.ajax.send();
	};

	
// LKGPS_MESSAGE represents a single LKGPS message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function LKGPS_MESSAGE(message)
{
	this.id		= message.id;
	this.type	= "TRACK";
	this.time	= new Date(message.pt);
//	this.battery=message.batteryState;
	this.latitude=message.lat;
	this.longitude=message.lng;
}
LKGPS_MESSAGE.prototype = new TRACKER_MESSAGE();
LKGPS_MESSAGE.prototype.constructor = LKGPS_MESSAGE;


// Create new LKGPS_TRACKER
function LKGPS_TRACKER(host, deviceID, deviceModel)
{
	this.id			= deviceID;
	this.ApiStatus	= new LKGPS_API(host + "/openapiv3.asmx/GetTracking?Model=" + deviceModel + "&Timezones=&MapType=&Language=&DeviceID=" + deviceID);
	this.ApiHistory	= new LKGPS_API(host + "/openapiv3.asmx/GetDevicesHistory?TimeZones=&MapType=Google&ShowLBS=0&SelectCount=99999&DeviceID=" + deviceID);
	this.getStatus	= function(callback)
	{
		this.ApiHistory.onSuccess = callback;
		this.ApiHistory.get(null, callback);
	};
	this.getHistory	= function(startDate, endDate, callback)
	{
		this.ApiHistory.onSuccess = callback;
		this.ApiHistory.get("StartTime=" + startDate.toJSON().substr(0,19) + "&EndTime=" + endDate.toJSON().substr(0,19), callback, this);
	};
	this.name		= deviceID;
	this.type		= deviceModel;
	this.message	= new Array();
	this.update = function(callback, startDate, endDate)
	{
		// Add time filter. Default start is 0300L this morning
		if(!startDate)
		{
			startDate = new Date();
			startDate.setMilliseconds(0);
			startDate.setSeconds(0);
			startDate.setMinutes(0);
			startDate.setHours(3);
			startDate.setDate(4);
		}

		// This default will give the latest data
		if(!endDate)
			endDate	= new Date("2100-01-01T00:00:00");

		this.lastUpdated=new Date();
		//this.getStatus(function(json)
		//{
		//	console.log(json);
		//});
		this.getHistory(startDate, endDate, function(json, tracker)
		{
			console.log(json);
			console.log(feed);
			for(var ix = 0 ; ix < json.devices.length ; ix++)
				tracker.message.push(new LKGPS_MESSAGE(json.devices[ix]));

			if(callback)
				callback(FEEDS.getFeed("LKGPS",tracker.id));
		});
	};
}
LKGPS_TRACKER.prototype = new TRACKER();
LKGPS_TRACKER.prototype.constructor = SPOT_TRACKER;



// LK-GPS_FEED object - inherits from FEED object
function LKGPS_FEED(id)
{
	this.type	="LKGPS";
	this.id		= id;
	this.host	= "http://www.lkgps.net:8080"
	this.tracker.push(new LKGPS_TRACKER(this.host, id, 102));
	this.update = function(callback, previous)
	{
		// Update all trackers, though usually only 1
		for(var ix=0; ix<this.tracker.length ; ix++)
			this.tracker[ix].update(callback);
	};
}
LKGPS_FEED.prototype = new FEED();
LKGPS_FEED.prototype.constructor = LKGPS_FEED;


// vim: ts=2:sw=2
