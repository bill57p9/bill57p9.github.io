
// Add altitude to GT_WGS84
GT_WGS84.prototype.altitude=null;

// Add radian conversion to GT_WGS84
GT_WGS84.prototype.getRadians=function()
{
	var deg2rad=function(degrees) { return degrees*Math.PI/180; }

	var radians=
	{
		latitude  : deg2rad(this.latitude ),
	 	longitude : deg2rad(this.longitude)
	};
	return radians;
}

// Add distance calculation function to GT_WGS84
GT_WGS84.prototype.getDistance=function(that)
{
	var earthRadius=6378.137; // km

	//Get corrected radius taking altitude into account
	var radius=function(wgs84)
	{
		return (wgs84.altitude ? earthRadius : earthRadius+wgs84.altitude)
	}

	var  here = this.getRadians();
	var there = that.getRadians();

	var a =
		Math.cos( here.latitude) *
		Math.cos(there.latitude) * 
		Math.pow(Math.sin((there.longitude-here.longitude)/2),2) +
		Math.pow(Math.sin((there.latitude -here.latitude )/2),2) ;

	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	// Use average radius
	return (c * (radius(this)+radius(that))/2);
}

// Add heading calculation (of that from this) to GT_WGS84 objects
GT_WGS84.prototype.getHeading=function(that)
{
	var  here = this.getRadians();
	var there = that.getRadians();

	var hdg = Math.atan2(
		Math.sin(there.longitude-here.longitude) * Math.cos(here.latitude) ,
		Math.cos (here.latitude) * Math.sin(there.latitude) -
		Math.sin (here.latitude) * Math.cos(there.latitude) *
		Math.cos(there.longitude-here.longitude));

	// Convert back to degrees
	// 0->360, rather than -180->+180
	hdg*=180/Math.PI;
	if(hdg<0)
		hdg+=360;

	return hdg;
}

// Get central location from the array of GT_WGS84s
GT_WGS84.prototype.getCentre = function(coords)
{
	var x			= new GT_WGS84;
	var valid		= 
	{
		"latlng"	: 0,
		"altitude"	: 0
	};
	x.latitude		= 0;
	x.longitude		= 0;
	coords.forEach(function (coord)
	{
		var latitude	= Number(coord.latitude );
		var longitude	= Number(coord.longitude);
		var altitude	= Number(coord.altitude );
		if(longitude && latitude)
		{
			x.latitude	+= latitude ;
			x.longitude	+= longitude;
			++valid.latlng;
		}
		if(altitude)
		{
			x.altitude += altitude;
			++valid.altitude;
		}
	});
	x.latitude		/= valid.latlng;
	x.longitude		/= valid.latlng;
	if(valid.altitude)
		x.altitude	/= valid.altitude;
	
	return x;
}

// Generic FEED object
// within each type, id must be unique
function FEED() { this.tracker	= new Array(); }
FEED.prototype.type				= null;
FEED.prototype.id				= null;
FEED.prototype.name				= "";
FEED.prototype.description		= "";
FEED.prototype.latestMessage	= null;
FEED.prototype.earliestMessage	= null;
FEED.prototype.lastUpdated		= null;
FEED.prototype.json				= {};
FEED.prototype.onUpdate			= function(){};
FEED.prototype.getTracker		= function(id)
{
	for(var fed=0; fed<this.tracker.length; fed++)
	{
		if(this.tracker[fed].id == id)
			return this.tracker[fed];
	}
	return null;
};	

// Generic TRACKER object
function TRACKER()
{
	this.message = new Array();
}
TRACKER.prototype.id	= 0;
TRACKER.prototype.name	= "";
TRACKER.prototype.type	= "";
TRACKER.prototype.status= "";
TRACKER.prototype.messageSort = function ()
{
	this.message.sort(function (a,b) { return (b.time - a.time); });
};

// TRACKER_MESSAGE represents a single TRACKER message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function TRACKER_MESSAGE() {}
TRACKER_MESSAGE.prototype			= new GT_WGS84();
TRACKER_MESSAGE.prototype.constructor = TRACKER_MESSAGE;
TRACKER_MESSAGE.prototype.id		= null;
TRACKER_MESSAGE.prototype.type		= "TRACK";
TRACKER_MESSAGE.prototype.time		= null;
TRACKER_MESSAGE.prototype.battery	= "";
TRACKER_MESSAGE.prototype.latitude	= 0;
TRACKER_MESSAGE.prototype.longitude	= 0;
TRACKER_MESSAGE.prototype.isTrack	= function()
{
	if("TRACK" == this.type)
		return true;
	return false;
};

// FEEDS is a global array of FEEDs, to allow callbacks
var FEEDS=new Object();
FEEDS.feed=new Array();
FEEDS.provider=new Array();

// Alphabetic sort on name
FEEDS.sortName = function(a,b)
{
	if(a.name>b.name)
		return 1;
	if(a.name<b.name)
		return -1;
	return 0;
}

// Get the feed object based on the id
FEEDS.getFeed = function(type, feedId)
{
	for(var ix=0; ix<FEEDS.feed.length; ix++)
		if(FEEDS.feed[ix].id == feedId && FEEDS.feed[ix].type == type)
			return FEEDS.feed[ix];
	return null
}

// Add a new FEED
FEEDS.addFeed = function(type, parameter)
{
	FEEDS.provider.forEach(function (provider)
	{
		if(type == provider.type)
		{	
			FEEDS.feed.push(new provider.construct(parameter));
			FEEDS.feed.sort(FEEDS.sortName)
			return true;
		}
	});
	return false;
}

// Initialisation function
FEEDS.init = function() { this.refresh(); };

// Refresh all feeds
FEEDS.refresh = function()
{
	for(var ix=0; ix<FEEDS.feed.length; ix++)
	{
		console.log(FEEDS.feed[ix]);
		FEEDS.feed[ix].update(FEEDS.feed[ix].onUpdate);
	}
}

// Return URI query parameters as an array of Key Value pairs
FEEDS.getURIParameters = function()
{
	var parameters = location.search.substring(1);
	if(parameters)
	{
		parameters = JSON.parse('{"parameters":[{"key":"' + parameters.replace(/&/g, '"},{"key":"').replace(/=/g,'","value":"') + '"}]}').parameters;
		parameters.forEach(function(param)
		{
			param.key	= decodeURIComponent(param.key  );
			param.value	= decodeURIComponent(param.value);
		} );
	}
	return parameters;
}

// Get single URL Parametes
FEEDS.getURIParameter = function(name)
{
	return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

FEEDS.addProvider = function(type, construct)
{
	FEEDS.provider.push({type, construct});
}

// This autopopulates feeds from the URI
FEEDS.addFromURI = function()
{
	FEEDS.getURIParameters().forEach(function (feed) { FEEDS.addFeed(feed.key, feed.value); } );
}

// vim: ts=2:sw=2