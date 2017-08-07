

// Display a feed
// Separating this out makes it easier to cope with non-referesh updates
FEED.prototype.onUpdate = function(feed)
{
	console.log(feed);
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

	for(var trackerIx=0; trackerIx<feed.tracker.length; trackerIx++)
	{
		var tracker=feed.tracker[trackerIx];
		
		// Define additional variable to store whether to display all tracks
		if(!tracker.trackMsgs)
			tracker.trackMsgs="hide"	// Default: Hide non-latest

		tbody.insertRow(-1).innerHTML=
			"<th colspan='5' align='left'>"
			+tracker.name+
			"</th>"+
			"<td colspan='2' alight='right'>"
			+ (tracker.status ? tracker.status : "")
			+"</td>";

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

			var row=tbody.insertRow(-1);
			row.title=message.type;

			insertCell(row,DAYS[message.time.getDay()]);
			insertCell(row,message.time.toLocaleTimeString());
			insertCell(row,message.battery ? "<img src='battery_"+message.battery+".png'>" : "");
			if(message.latitude && message.longitude)
				insertCell(row,"<a href='http://www.streetmap.co.uk/newprint.srf?x="+
					osgb.eastings+"&y="+osgb.northings+"&z=4&ar=Y'>"+
					osgb.getGridRef(3)+"</a>");
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
				if("hide"==tracker.trackMsgs)
				{
					if(0==trackMsgCount)
						row.style.display="none";	// Hidden row
					else
					{
						insertCell(row,"<a href='javascript:FEEDS.trackMsgDisplay(\""+feed.type+"\",\""+feed.id+"\","+trackerIx+",\"show\");'><i>("+(trackMsgCount-1)+" hidden)</i></a>","left");
						trackMsgCount=0;
					}
				}
				else
					insertCell(row,"<a href='javascript:FEEDS.trackMsgDisplay(\""+feed.type+"\",\""+feed.id+"\","+trackerIx+",\"hide\");'><i>(hide old)</i></a>","left");
			}
			else
				insertCell(row,message.type,"left");
		}
	}

	tbody.id = "msgs."+feed.type+"."+feed.id;
	// Now paste the tbody over the existing TBODY
	var table = document.getElementById(tbody.id);
	if(table)
		table.innerHTML=tbody.innerHTML;
	else
		document.getElementById("tblMessages").appendChild(tbody);

	// Update the timestamp
	console.log(FEEDS);
	document.getElementById("updateTimestamp").innerHTML=
		FEEDS.feed[0].lastUpdated.toLocaleTimeString() + " " +
		DAYS[FEEDS.feed[0].lastUpdated.getDay()]       + " " +
		FEEDS.feed[0].lastUpdated.toLocaleDateString();

	// Reset the auto update timer
	FEEDS.updateTimer();
}

// This function sets the displayability of the trackMsgs
// hide=hide all bar latest
// show=show all
FEEDS.trackMsgDisplay=function(type, feedId, tracker, trackMsgs)
{
	var feed=FEEDS.getFeed(type, feedId);
	feed.tracker[tracker].trackMsgs=trackMsgs;
	feed.onUpdate(feed);
}



// vim: ts=2:sw=2
