




// Call to refresh / update feed messages
FEEDS.refresh=function()
{
	var startDate	= document.getElementById("startDate").value;
	
	// If startDate has NOT changed since last refresh, send NULL to get latest/default messages
	if(startDate == FEEDS.feed[0].startDate)
		startDate = null;
	FEEDS.getMessages(startDate, document.getElementById("endDate").value);
};



FEEDS.updateTimeout=null;
// This function sets the updateTimer
// based on the menu setting & last update timestamp
FEEDS.updateTimer=function()
{
	// Clear existing timer (if applicable)
	if(FEEDS.updateTimeout)
		clearTimeout(FEEDS.updateTimeout);

	// Get the timer setting
	var timerList=document.getElementById("updateInterval");
	var timeout=timerList.options[timerList.selectedIndex].value;

	if(timeout>0)
	{
		var now=new Date();

		// Timer is specified in minutes. Needs milliseconds
		timeout *= 60000;

		// Now we need to adjust the timeout based on the last update
		// & current time
		timeout -= (now.getTime() - FEEDS.feed[0].lastUpdated.getTime());

		console.log(timeout);

		if(timeout > 0)
			FEEDS.updateTimeout=setTimeout(FEEDS.refresh, timeout);
		else	 // Cover off getting a negative number
			FEEDS.update();
	}
};

// Generic helper function to create Download links for IE & HTML5
FEEDS.setDownloadLink = function(linkId, filename, format, content)
{
	link = document.getElementById(linkId);
	if(link)
	{
		// Setting up the download link differs between IE & other browsers
		if(window.navigator.msSaveOrOpenBlob)
		{
			// IE10+
			link.onclick	= function()
			{
				window.navigator.msSaveOrOpenBlob(new Blob([content]), filename);
			};
		}
		else
		{
			// HTML5 (e.g. Chrome)
			link.download	= filename;
			link.href		= "data:" + format +";charset=utf-8," + encodeURIComponent(content);
		}
	}
};

////////////////////
//                //
// INITIALISATION //
//                //
////////////////////

// Day of week -> Name conversion
var DAYS=new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

// Get the data once document is fully loaded
window.onload = function()
{
	// Get feeds
	FEEDS.addFromURI();

	// Get startDate & endDate from query string
	document.getElementById("startDate").value	= FEEDS.getURIParameter("startDate");
	document.getElementById("endDate").value	= FEEDS.getURIParameter("endDate");

	FEEDS.refresh();
	


	// Read back (default) startDate
	document.getElementById("startDate").value	= FEEDS.feed[0].startDate.getJSONlocal().substr(0,16);
}

// vim: ts=2:sw=2
