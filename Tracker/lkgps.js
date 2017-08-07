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

	
// LKGPS_MESSAGE represents a single LKGPS message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function LKGPS_MESSAGE(message)
{
	this.id		= message.id;
	this.time	= new Date(message.pt);
	this.latitude=message.lat;
	this.longitude=message.lng;
}
LKGPS_MESSAGE.prototype = new TRACKER_MESSAGE();
LKGPS_MESSAGE.prototype.constructor = LKGPS_MESSAGE;


// LKGPS_TRACKER is a type of TRACKER
function LKGPS_TRACKER(host, deviceID, deviceModel)
{
	this.id			= deviceID;
	this.ApiStatus	= new LKGPS_API(host + "/openapiv3.asmx/GetTracking?Model=" + deviceModel + "&Timezones=&MapType=&Language=&DeviceID=" + deviceID);
	this.ApiTrack	= new LKGPS_API(host + "/openapiv3.asmx/GetDevicesHistory?TimeZones=&MapType=Google&ShowLBS=0&SelectCount=99999&DeviceID=" + deviceID);
	this.name		= deviceID;
	this.type		= deviceModel;
	this.message	= new Array();
}
LKGPS_TRACKER.prototype				= new TRACKER();
LKGPS_TRACKER.prototype.constructor = LKGPS_TRACKER;
LKGPS_TRACKER.prototype.latestMessage	= null;
LKGPS_TRACKER.prototype.getTrack	= function(startDate, endDate, callback)
{
	// Default start is 0300L this morning
	if(!startDate)
	{
		startDate = new Date();
		// Subtract a day for anything prior to 0500L
		if(startDate.getHours() < 5)
			startDate.setTime(startDate.getTime() - (24 * 60 * 60 * 1000));
		startDate.setMilliseconds(0);
		startDate.setSeconds(0);
		startDate.setMinutes(0);
		startDate.setHours(3);
		startDate.setDate(4);
	}

	// This default will give the latest data
	if(!endDate)
		endDate	= new Date("2100-01-01T00:00:00");

	this.ApiTrack.onSuccess = callback;
	this.ApiTrack.get("StartTime=" + startDate.toJSON().substr(0,19) + "&EndTime=" + endDate.toJSON().substr(0,19), callback, this);
};
LKGPS_TRACKER.prototype.update		= function(callback, startDate, endDate)
{
	this.lastUpdated=new Date();	// Simple timestamp of when we last tried an update
	//this.getStatus(function(json)
	//{
	//	console.log(json);
	//});
	this.getTrack(startDate, endDate, function(json, tracker)
	{
		console.log(json);
		// Read messages & latestMessage marker
		for(var ix = 0 ; ix < json.devices.length ; ix++)
			tracker.message.push(new LKGPS_MESSAGE(json.devices[ix]));
		tracker.latestMessage = new Date(json.lastDeviceUtcDate);

		// Sort messages
		tracker.message.sort(function (a,b) { return (b.time - a.time); });
		
		if(callback)
			callback(FEEDS.getFeed("LKGPS",tracker.id));
	});
};



// LK-GPS_FEED object - inherits from FEED object
function LKGPS_FEED(id)
{
	this.id		= id;
	this.tracker.push(new LKGPS_TRACKER(this.host, id, 102));
}
LKGPS_FEED.prototype = new FEED();
LKGPS_FEED.prototype.constructor = LKGPS_FEED;
LKGPS_FEED.prototype.type		= "LKGPS";
LKGPS_FEED.prototype.host		= "http://www.lkgps.net:8080";
LKGPS_FEED.prototype.update		= function(callback, previous)
{
	// Update all trackers, though usually only 1
	for(var ix=0; ix<this.tracker.length ; ix++)
		this.tracker[ix].update(callback);	
};

// ZG666GPS is a derivative of LKGPS: Same API, etc
function ZG666_FEED() {}
ZG666_FEED.prototype				= new LKGPS_FEED;
ZG666_FEED.prototype.constructor	= LKGPS_FEED;
ZG666_FEED.prototype.host			= "http://211.162.69.241:8088/openapiv3.asmx";
ZG666_FEED.prototype.type			= "ZG666";

// ZG888GPS is a derivative of LKGPS: Same API, etc
function ZG888_FEED() {}
ZG888_FEED.prototype				= new LKGPS_FEED;
ZG888_FEED.prototype.constructor	= LKGPS_FEED;
ZG888_FEED.prototype				= new LKGPS_FEED;
ZG888_FEED.prototype.host			= "http://app.zg002gps.com/OpenAPIV3.asmx";
ZG888_FEED.prototype.type			= "ZG888";



// vim: ts=2:sw=2
