
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
		if(! null == altitude)
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

GT_WGS84.prototype.isValid = function()
{
    var notValid =
        (
            this.latitude < -90 ||
            this.latitude > 90 ||
            this.longitude < -180 ||
            this.longitude > 180
        );
    return !notValid;
};

// Add toCoords to prototype
GT_WGS84.prototype.toCoords = function(separator)
{
    if (!this.isValid())
        return "invalid";

    var coords =
        Math.abs(this.latitude) +
        (this.latitude < 0 ? "S" : "N") +
        separator +
        Math.abs(this.longitude) +
        (this.longitude < 0 ? "W" : "E");

    return coords;
}

// Get JSON LOCAL format timestamp
Date.prototype.getJSONlocal = function()
{
	// Pad string to given length
	var pad = function(inStr, length)
	{
		var outStr		= new String(inStr);
		while(outStr.length	< length)
			outStr			= "0" + outStr;
		return outStr;
	};

	// Convert minutes to +/-hhmm format
	var min2hhmm	= function(minutes)
	{
		var hours	= Math.floor(minutes/60);

		return	(minutes < 0 ? "-" : "+") +
				pad(Math.abs(hours)					,2) +
				pad(Math.abs(minutes - (hours*60))	,2);
	}

	// Get TZ offset as hours (float), always >0
	var tz		= Math.abs(this.getTimezoneOffset())/60;

	// Convert to local time string
	var jsonDate=
		pad( this.getFullYear()		,4)	+ "-" +
		pad((this.getMonth() + 1)	,2)	+ "-" +
		pad( this.getDate()			,2)	+ "T" +
		pad( this.getHours()		,2)	+ ":" +
		pad( this.getMinutes()		,2) + "." +
		pad( this.getMilliseconds()	,3) +
		min2hhmm(this.getTimezoneOffset());

	return jsonDate;
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
FEED.prototype.startDate		= null;
FEED.prototype.endDate			= null;
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
// Sort & remove duplicates messages
FEED.prototype.postUpdate = function(feed)
{
	feed.tracker.forEach(function(tracker)
	{
		tracker.messageSort();
		for(var ix=1; ix<tracker.message.length; ++ix)
		{
			if(tracker.message[ix].id == tracker.message[ix-1].id)
				tracker.message.splice(--ix,1);
		}
	});
	feed.onUpdate(feed);
};
// Deal with top level functionality, such as ensuring startDate & endDate are sensible,
// then call .getFeedMessages
FEED.prototype.getMessages		= function(startDate, endDate, callback)
{
	this.endDate = endDate ? new Date(endDate) : null;

	if(startDate && (this.startDate ? new Date(startDate).getTime() != this.startDate.getTime() : true))
		this.startDate = new Date(startDate);
	else	// startDate not pre-defined
	{
		if(this.lastUpdated)
			this.startDate = this.lastUpdated;	// Get since last Update
		else if(!this.startDate)
		{
			// Default is 0300L this morning (0300L yesterday if before 0500L)
			this.startDate = new Date();
			// Subtract a day for anything prior to 0500L
			if(this.startDate.getHours() < 5)
				this.startDate.setTime(this.startDate.getTime() - (24 * 60 * 60 * 1000));
			this.startDate.setMilliseconds(0);
			this.startDate.setSeconds(0);
			this.startDate.setMinutes(0);
			this.startDate.setHours(3);
		}
	}

	// Filter obsolete messages
	var feed = this;
	this.tracker.forEach(function(tracker)
	{
		if(tracker.message.length && startDate)
		{
			// Oldest messages will always be at the end
			while(tracker.message[tracker.message.length-1].time.getTime() < feed.startDate)
				tracker.message.pop();
		}

		if(tracker.message.length && endDate)
			// Newest messages will always be at the front
			while(tracker.message[0].time.getTime() > feed.endDate)
				tracker.message.shift();
	});

	this.lastUpdated=new Date();	// Simple timestamp of when we last tried an update

	// Call underlying get function
	this.getFeedMessages(this.startDate, this.endDate, callback);
};
FEED.prototype.getFeedMessages	= function(startDate, endDate, callback)
{
	// Update all trackers within feed
	this.tracker.forEach( function (tracker)
	{
		tracker.getMessages(startDate, endDate, callback);
	});
};



// Generic TRACKER object
function TRACKER(id)
{
	this.message = new Array();
	this.id = ("number" == typeof(id)) ? id : 0;
}
TRACKER.prototype.name	= "";
TRACKER.prototype.constructor = TRACKER;
TRACKER.prototype.type	= "";
TRACKER.prototype.status= "";
TRACKER.prototype.trackWidth = 4;
TRACKER.prototype.trackOpacity	= 0.5;
TRACKER.prototype.trackColour	= 0;
TRACKER.prototype.trackColourRGB	= function()
{
	var rgb = this.trackColour.toString(16);
	while(rgb.length < 6)
		rgb = "0" + rgb;
	return rgb;
};
TRACKER.prototype.trackColourKml = function()
{
	// Recalculate opacity as a 1 byte hex number
	var opacity = Math.round(255*this.trackOpacity).toString(16);
	if (opacity.length < 2)
		opacity = "0" + opacity;

	// Get RGB (hex)
	var rgb = this.trackColourRGB();

	// KML color format is aabbggrr - in hex. aa is opacity
	return	opacity
		+	rgb.substr(4,2)
		+	rgb.substr(2,2)
		+ 	rgb.substr(0,2);
};
TRACKER.prototype.messageSort = function ()
{
	this.message.sort(function (a,b) { return (b.time - a.time); });
};
// Get Ozi PLT file
// PLT files are single track, hence implemented at TRACKER level
TRACKER.prototype.getOziPlt = function()
{
	var plt = "";
	var points = 0;

	// Messages are latest first, so we build file backwards
	this.message.forEach(function (message)
	{
		if(message.hasLocation())
		{
			var tDateTime	= 25569+(message.time.getTime()/86400000);		// TDateTime 25569 is 01/01/1970 0000Z
			var altitude	= -777;		// = not valid
			if(message.hasAltitude())
				altitude	= 3.2808*message.altitude;		// in feet

			// latitude, longitude, 0=contiguous track, altitude_ft (-777 = not valid), TDateTime, Date_str, Time_str
			plt =
				message.latitude.toString()	+ "," +
				message.longitude.toString()+ "," +
				"0," + altitude.toString()	+ "," +
				tDateTime.toString()		+ "," +
				message.time.toLocaleDateString()	+ "," +
				message.time.toLocaleTimeString() + "\r\n" + plt;
			++points;
		}
	});

	plt =
		"OziExplorer Track Point File Version 2.1\r\n" +
		"WGS 84\r\n" +
		"Altitude is in Feet\r\n" +
		"Reserved 3\r\n" +
		"0,1," + this.trackColour + "," + this.name + ",0,0,2," + this.trackColour + "\r\n" +
		points.toString() + "\r\n" + plt;

	return plt;
};

// Get length of track within a TRACKER object
TRACKER.prototype.getTrackLength = function()
{
  var length = 0, previousMessage = false;
  this.message.forEach(function (message)
  {
    if(message.hasLocation())
    {
      // skip for first valid message
      if(previousMessage)
        length += message.getDistance(previousMessage);
      previousMessage = message;
    }
  })
  return length;
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
TRACKER_MESSAGE.prototype.latitude	= 180;
TRACKER_MESSAGE.prototype.longitude	= 180;
TRACKER_MESSAGE.prototype.isTrack	= function()
{
	if("TRACK" == this.type)
		return true;
	return false;
};
TRACKER_MESSAGE.prototype.hasLocation = TRACKER_MESSAGE.prototype.isValid;

TRACKER_MESSAGE.prototype.hasAltitude = function()
{
	return (null != this.altitude);
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
		{
			return FEEDS.feed[ix];
		}
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
			FEEDS.feed.sort(FEEDS.sortName);
			return true;
		}
	});
	return false;
}

// get messages for all feeds
FEEDS.getMessages = function(startDate, endDate)
{
	FEEDS.feed.forEach(function(feed)
	{
		// Check that we have colours
		// This is an attempt to ensure they are allocated consistently
		feed.tracker.forEach(function (tracker)
		{
			if(!tracker.trackColour)
				tracker.trackColour = FEEDS.trackerColour.shift();
		});

		console.log(feed);
		feed.getMessages(startDate, endDate, feed.postUpdate);
	});
}

// Returns KML file of all feeds/trackers
FEEDS.getKml = function()
{
	if(FEEDS.feed[0].endDate)
		var txt = FEEDS.feed[0].endDate.toLocaleString();
	else
		var txt = FEEDS.feed[0].lastUpdated.toLocaleString();

	// File Header string
	txt	= "<?xml version='1.0' encoding='UTF-8' standalone='no'?>\r\n"
		+ "<kml xmlns='http://www.opengis.net/kml/2.2' xmlns:atom='http://www.w3.org/2005/Atom' xmlns:gx='http://www.google.com/kml/ext/2.2' xmlns:kml='http://www.opengis.net/kml/2.2'>\r\n"
		+ "\t<Document>\r\n"
		+ "\t\t<name>Tracker</name>\r\n"
		+ "\t\t<description>Tracker data from " + FEEDS.feed[0].startDate.toLocaleString().replace(",","")
		+ " to " + txt.replace(",","") + "</description>\r\n";

	FEEDS.feed.forEach(function (feed)
	{
		feed.tracker.forEach(function (tracker)
		{
			// Create style name
			var style = feed.type + "_" + tracker.type;

			// Determine altitudeMode
			// Only give a real altitude IF ALL messages with a location have a valid altitude
			var altitudeMode = "absolute";
			tracker.message.forEach(function (message)
			{
				if(message.hasLocation() && !message.hasAltitude())
					altitudeMode = "relativeToGround";
			});

			txt+= "\t\t<Style id='" + style +"'>\r\n"
				+ "\t\t\t<LineStyle>\r\n"
				+ "\t\t\t\t<color>" + tracker.trackColourKml() + "</color>\r\n"
				+ "\t\t\t\t<width>" + tracker.trackWidth + "</width>\r\n"
				+ "\t\t\t</LineStyle>\r\n"
				+ "\t\t\t</Style>\r\n"
				+ "\t\t<Placemark>\r\n"
				+ "\t\t\t<name>" + tracker.name + "</name>\r\n"
				+ "\t\t\t<styleUrl>#" + style + "</styleUrl>\r\n"
				+ "\t\t\t<LineString>\r\n"
				+ "\t\t\t\t<tessellate>1</tessellate>\r\n"
				+ "\t\t\t\t<extrude>1</extrude>\r\n"
				+ "\t\t\t\t<altitudeMode>" + altitudeMode + "</altitudeMode>\r\n"
				+ "\t\t\t\t<coordinates>\r\n"
				;
				// NB: Assumes all messages either have or don't have altitude

			tracker.message.forEach( function (message)
			{
				if(message.hasLocation())
					txt	+= "\t\t\t\t\t"
						+ message.longitude.toString() + ","
						+ message.latitude.toString()  + ","
						+(	altitudeMode == "absolute"
							? message.altitude.toString()
							: "0" )
						+ "\r\n"
						;
			});
			txt+= "\t\t\t\t</coordinates>\r\n"
				+ "\t\t\t</LineString>\r\n"
				+ "\t\t</Placemark>\r\n"
				;
		});
	});
	txt +=
		"\t</Document>\r\n" +
		"</kml>\r\n" ;

	return txt;
};

// Returns GPX file of all feeds/trackers
FEEDS.getGpx = function()
{
	if(FEEDS.feed[0].endDate)
		var txt = FEEDS.feed[0].endDate.toLocaleString();
	else
		var txt = FEEDS.feed[0].lastUpdated.toLocaleString();

	// File Header string
	var txt
		= "<?xml version='1.0' encoding='UTF-8'?>\r\n"
		+ "<gpx xmlns='http://www.topografix.com/GPX/1/1'>\r\n"
		+ "\t<metadata>\r\n"
		+ "\t\t<text>Tracker data from " + FEEDS.feed[0].startDate.toLocaleString().replace(",","")
		+ " to " + txt + "</text>\r\n"
		+ "\t</metadata>\r\n" ; // TODO: MetaData. Example has link

	FEEDS.feed.forEach(function (feed)
	{
		feed.tracker.forEach(function (tracker)
		{
			txt +=
				"\t<trk>\r\n" +
				"\t\t<name>" + tracker.name + "</name>\r\n" +
				"\t\t<trkseg>\r\n" ;
			tracker.message.forEach( function (message)
			{
				if(message.hasLocation())
				{
					txt	+="\t\t\t<trkpt"
						+ " lat='" + message.latitude.toString()	+ "'"
						+ " lon='" + message.longitude.toString()	+ "'>\r\n";
					if(message.hasAltitude())
						txt += "\t\t\t\t<ele>"	+ message.altitude.toString()	+ "</ele>\r\n";
					txt +="\t\t\t\t<time>" + message.time.toJSON() + "</time>\r\n"
						+ "\t\t\t</trkpt>\r\n";
				}
			});
			txt +=
				"\t\t</trkseg>\r\n" +
				"\t</trk>\r\n";
		});
	});
	txt += "</gpx>\r\n" ;

	return txt;
};

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

// Set tracker colours
FEEDS.trackerColour =
[
	0x0000CC,
	0x00CC00,
	0x00CCCC,
	0xCC0000,
	0xCC00CC,
	0xCCCC00,
	0xCCCCCC,
	0x000066,
	0x006600,
	0x006666,
	0x660000,
	0x660066,
	0x666600,
	0x666666
];


// vim: ts=2:sw=2
