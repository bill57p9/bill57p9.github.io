
// Add a method to GT_OSGB to get OpenLayersGeometryPoint or OpenSpaceMapPoint
GT_OSGB.prototype.getOpenLayersGeometryPoint = function()
{
	return new OpenLayers.Geometry.Point(this.eastings, this.northings);
}
GT_OSGB.prototype.getOpenSpaceMapPoint = function()
{
	return new OpenSpace.MapPoint(this.eastings, this.northings);
}



// Show/hide a marker for a particular message location
TRACKER_MESSAGE.prototype.openSpaceMarker = 
{
	obj				: null,
	icon			: 'https://openspace.ordnancesurvey.co.uk/osmapapi/img_versions/img_1.0.1/OS/images/markers/round-marker-lrg-red.png',
	size			: { x:17, y:17 },
	offset			: { x:-8, y:-8 }
};
TRACKER_MESSAGE.prototype.openSpaceShow = function()
{
	if(!this.openSpaceMarker.obj)
		this.openSpaceMarker.obj = osMap.createMarker
		(
			this.getOSGB().getOpenSpaceMapPoint(),	// position
			new OpenSpace.Icon
			(
				this.openSpaceMarker.icon,	// icon URL
				new OpenLayers.Size (this.openSpaceMarker.size.x,   this.openSpaceMarker.size.y),
				new OpenLayers.Pixel(this.openSpaceMarker.offset.x, this.openSpaceMarker.offset.y),
				null,
				null
			)
		)
}
TRACKER_MESSAGE.prototype.openSpaceHide = function()
{
	if(this.openSpaceMarker.obj)
	{
		osMap.removeMarker(this.openSpaceMarker.obj);
		this.openSpaceMarker.obj = null;	
	}
	
}
TRACKER_MESSAGE.prototype.openSpaceToggle = function()
{
	this.openSpaceMarker.obj ? this.openSpaceHide() : this.openSpaceShow();
}

// Set layout & sizes
FEEDS.resize = function()
{
	var map = document.getElementById("map");
	var tbl = document.getElementById("divMessages");
	var upd = document.getElementById("divUpdate");
	
	if(window.innerWidth > window.innerHeight && window.innerWidth > 900)
	{
		// Landscape, map on left
		map.style.width		= (window.innerWidth  - 420)+"px";
		map.style.height	= (window.innerHeight -  20)+"px";
		tbl.style.marginLeft= map.style.width + 30;
		tbl.style.overflowY	= 'scroll';
		tbl.style.height	= (window.innerHeight - 100)+"px";
		upd.style.position	= 'absolute';
		upd.style.bottom	= '10px';
		upd.style.right		= '0px';
		upd.style.width		= '390px';
	}
	else
	{
		// Portrait, map on top
		map.style.width		= (window.innerWidth  -  20)+"px";
		map.style.height	=
		(
			(window.innerWidth < window.innerHeight)	? window.innerWidth  -  20
														: window.innerHeight - 200
		)+"px";
		tbl.style.marginLeft= null;	
		tbl.style.height	= 'auto';
		upd.style.bottom	= null;
		upd.style.position	= 'static';
	}
	
	if(osMap)
		osMap.updateSize();
}


// Display a feed
// Separating this out makes it easier to cope with non-referesh updates
FEED.prototype.onUpdate = function(feed)
{
	console.log(FEEDS);
	
	// initialise the map if required
	if(!osMap)
	{
		FEEDS.resize();
		osMap = new OpenSpace.Map('map', {resolutions: [2500, 1000, 500, 200, 100, 50, 25, 10, 5, 4, 2.5, 2, 1]});
		
		//configure map options (basicmap.js)
		setglobaloptions();
		// add a box displaying co-ordinates (mouse over map to display) 
		//makegrid();
	}

	// Loop through all latest message on all trackers & all feeds to build up an array of latest positions, to get average
	var trackerPosns = new Array();
	FEEDS.feed.forEach(function(feed)
	{
		feed.tracker.forEach(function(tracker)
		{
			if(tracker.message.length > 0)
				trackerPosns.push(tracker.message[0]);
		});
	});

	if(trackerPosns.length > 0)
	{
		// Identify centre & range (max distance to tracker)
		var trackerCentre	= new GT_WGS84().getCentre(trackerPosns);
		var trackerRange	= 0;
		trackerPosns.forEach(function(trackerPosn)
		{
			var trackerDistance = trackerCentre.getDistance(trackerPosn);
			if(trackerDistance > trackerRange)
				trackerRange = trackerDistance;
		});
		
		//set the center of the map and the zoom level
		osMap.setCenter(trackerCentre.getOSGB().getOpenSpaceMapPoint(), osMap.zoom ? osMap.zoom : 8);
	}

	
	var insertCell=function(tblRow, html, align)
	{
		if(!align)
			align="right";

		var newCell=tblRow.insertCell(-1);
		newCell.align=align;
		newCell.innerHTML=html;
	};

	// We have a TBODY for each feed, not TRACKER
	var tbody=document.createElement("tbody");

	tbody.innerHTML=
		"<tr><th colspan='5' align='left'>"
		+feed.name+
		"</th></tr>";


	feed.tracker.forEach(function(tracker)
	{
		if(!tracker.trackColour)
			tracker.trackColour = FEEDS.trackerColour.shift();

		var osMapPoints = new Array();
		
		// Define additional variable to store whether to display all tracks
		if(!tracker.trackMsgs)
			tracker.trackMsgs="hide";	// Default: Hide non-latest

		tbody.insertRow(-1).innerHTML
			= "<th colspan='4' align='left'>"
			+ "<a id='" + JSON.stringify
			({
				feedType	: feed.type,
				feedId		: feed.id,
				trackerId	: tracker.id
			})
			+ "'>"
			+ tracker.name
			+ "</a></th>"
			+ "<td>"
			+ tracker.getTrackLength().toFixed(2)
			+ " km</td>"
			+ "<td colspan='2' alight='right' bgcolor='#"
			+ tracker.trackColourRGB() + "'>"
			+ (tracker.status ? tracker.status : "")
			+ "</td>";

		// First we count the number of TRACK messages if hiding them
		var trackMsgCount=-1;
		if("hide"==tracker.trackMsgs)
		{
			trackMsgCount=0;
			for(var msgIx=0; msgIx<tracker.message.length; msgIx++)
				if(tracker.message[msgIx].isTrack())
					trackMsgCount++;
		}

		//Messages are already in reverse Chronological order
		for(var msgIx=0; msgIx<tracker.message.length; msgIx++)
		{
			var message=tracker.message[msgIx];

			var osgb=message.getOSGB();

			osMapPoints.push(osgb.getOpenLayersGeometryPoint());
			
			var row=tbody.insertRow(-1);
			row.title=message.type;
			row.id = JSON.stringify
			({
				feedType	: feed.type,
				feedId		: feed.id,
				trackerId	: tracker.id,
				messageIx	: msgIx
			});
			row.onmouseenter = function()
			{
				var id	= JSON.parse(this.id);
				document.getElementById(this.id).style.backgroundColor = "grey";
				FEEDS.getFeed(id.feedType, id.feedId).getTracker(id.trackerId).message[id.messageIx].openSpaceShow();
			};
			row.onmouseleave = function()
			{
				var id = JSON.parse(this.id);
				document.getElementById(this.id).style.backgroundColor = "white";
				FEEDS.getFeed(id.feedType, id.feedId).getTracker(id.trackerId).message[id.messageIx].openSpaceHide();
			};

			insertCell(row,DAYS[message.time.getDay()]);
			insertCell(row,message.time.toLocaleTimeString());
			insertCell(row,message.battery ? "<img src='battery_"+message.battery.replace("%","pc")+".png' alt='"+message.battery+"'/>" : "");
			if(message.latitude && message.longitude)
				insertCell(row,"<a href='javascript:osMap.setCenter(new OpenSpace.MapPoint("
					+ osgb.eastings + "," + osgb.northings + "))'>"
					+ osgb.getGridRef(3).replace(" ","") +"</a>");
			else
				insertCell(row,"");

			if(tracker.message.length-1 > msgIx)
			{
				// Reverse chronological order, hence previous in time
				// is next in the array
				var previousMessage=tracker.message[msgIx+1];

				// Speed
				// km/s =           dist(km) /  time(s)
				// km/h = 3600    * dist(km) / (time(ms) / 1000) 
				// km/h = 3600000 * dist(km) / time(ms) 
				insertCell(row,(
					3600000*message.getDistance(previousMessage) /
					(message.time.getTime()-previousMessage.time.getTime())
					).toFixed(1)+" km/h");

				insertCell(row,
					previousMessage.getHeading(message).toFixed(0)
					+" deg");
			}
			else
			{
				row.insertCell(-1);
				row.insertCell(-1);
			}

			if(message.isTrack())
			{
				var url =
					"<a href='javascript:FEEDS.trackMsgDisplay(\""
					+ feed.type		+ "\",\""
					+ feed.id		+ "\",\""
					+ tracker.id	+ "\",\"";
				if("hide"==tracker.trackMsgs)
				{
					if(0==trackMsgCount)
						row.style.display="none";	// Hidden row
					else
					{
						insertCell(row, url + "show\");'><i>("+(trackMsgCount-1)+" hidden)</i></a>","left");
						trackMsgCount=0;
					}
				}
				else
					insertCell(row, url + "hide\");'><i>(hide old)</i></a>","left");
			}
			else
				insertCell(row,message.type,"left");
		}
		// Only actually try to draw lines if we have any TRACKER messages
		if(tracker.message.length)
		{
			var lineString	= new OpenLayers.Geometry.LineString(osMapPoints);
			var lineFeature = new OpenLayers.Feature.Vector
			(
				lineString,
				null,
				{
					strokeColor		: "#" + tracker.trackColourRGB(),
					strokeOpacity	: tracker.trackOpacity,
					strokeWidth		: tracker.trackWidth
				}
			);
			osMap.getVectorLayer().addFeatures([lineFeature]);
		}
	});
	
	tbody.id = JSON.stringify
	({
		feedType	: feed.type,
		feedId		: feed.id
	});
	
	// Now paste the tbody over the existing TBODY
	var table		= document.getElementById("tblMessages");
	var tableBody	= document.getElementById(tbody.id);
	
	if(tableBody)
		table.replaceChild(tbody, tableBody);
	else
		table.appendChild(tbody);

	// Update the timestamp
	document.getElementById("updateTimestamp").innerHTML=
		DAYS[FEEDS.feed[0].lastUpdated.getDay()]       + " " +
		FEEDS.feed[0].lastUpdated.toLocaleTimeString() ;

	FEEDS.setDownloadLink("getKML", "Tracks.kml", "text/xml", FEEDS.getKml());
	FEEDS.setDownloadLink("getGPX", "Tracks.gpx", "text/xml", FEEDS.getGpx());
	FEEDS.feed.forEach(function(feed)
	{
		feed.tracker.forEach(function(tracker)
		{
			FEEDS.setDownloadLink
			(
				JSON.stringify
				({
					feedType	: feed.type,
					feedId		: feed.id,
					trackerId	: tracker.id
				}), "Track.plt", "text/csv", tracker.getOziPlt()
			);
		});
	});


	// Reset the auto update timer
	FEEDS.updateTimer();
}

// This function sets the displayability of the trackMsgs
// hide=hide all bar latest
// show=show all
FEEDS.trackMsgDisplay=function(feedType, feedId, trackerId, trackMsgs)
{
	var feed=FEEDS.getFeed(feedType, feedId);
	feed.getTracker(trackerId).trackMsgs=trackMsgs;
	feed.onUpdate(feed);
}


// Global osMap variable
osMap = null;

// vim: ts=2:sw=2
