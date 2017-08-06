// lkgps.js
// Supports LKGPS type feeds by DeviceID (1 tracker per feed)

// LKGPS_API - inherits from XMLHttpRequest
function LKGPS_API(baseURL)
{
	this.parser		= new DOMParser();
	this.baseURL	= baseURL;
	this.ajax		= new XMLHttpRequest();
}
LKGPS_API.prototype.constructor = LKGPS_API;
LKGPS_API.prototype.get = function(params, callback)
	{
		// Set up callback
		this.ajax.onreadystatechange = function()
		{
			if (this.readyState == 4 && this.status == 200)
				callback(JSON.parse(parser.parseFromString(this.responseText, "text/xml").childNodes[0].textContent));
		};

		// Set full URL
		var url = this.baseURL + "&Key=7DU2DJFDR8321"
		if(params)
			url = url + "&" + params
		this.ajax.open("GET", "http://anyorigin.com/go/?url=" + encodeURIComponent(url), true );
		this.ajax.send();
	};


// Create new LKGPS_TRACKER
function LKGPS_TRACKER(host, deviceID, deviceModel)
{
	this.id			= deviceID;
	this.ApiStatus	= new LKGPS_API(host + "/openapiv3.asmx/GetTracking?Model=" + deviceModel + "&Timezones=&MapType=&Language=&DeviceID=" + deviceID);
	this.ApiHistory	= new LKGPS_API(host + "/openapiv3.asmx/GetDevicesHistory?TimeZones=&MapType=&ShowLBS=0&SelectCount=99999&DeviceID=" + deviceID);
	this.getStatus	= function(callback)
	{
		this.ApiHistory.onSuccess = callback;
		this.ApiHistory.get(null, callback);
	};
	this.getHistory	= function(startDate, endDate, callback)
	{
		this.ApiHistory.onSuccess = callback;
		this.ApiHistory.get("StartTime=" + startDate + "&EndTime=" + endDate, callback);
	};
	this.name		= deviceID;
	this.type		= deviceModel;
	this.message	= new Array();
	this.update = function(callback, startDate, endDate)
	{
		// Add time filter
		if(!startDate)
			startDate = "2017-07-24"
		
		if(!endDate)
			endDate	= "2100-01-01"

		this.lastUpdated=new Date();
		this.getStatus(function(json)
		{
			console.log(json);
		});
		this.getHistory(startDate, endDate, function(json)
		{
			console.log(json);
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
