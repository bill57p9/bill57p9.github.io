/////////////////////////////////////////
//                                     //
// ADD METHODS TO SPOT_MESSAGE OBJECTS //
//                                     //
/////////////////////////////////////////
//

// Get earlier data
FEEDS.getHistory=function()
{
// *******************************************************************************
// Should this check for SPOT only???
	for(var ix=0; ix<FEEDS.feed.length; ix++)
		FEEDS.feed[ix].update(FEEDS.feed[ix].onUpdate, null, true);
}

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
}


////////////////////
//                //
// INITIALISATION //
//                //
////////////////////

// Day of week -> Name conversion
var DAYS=new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

// Get feeds
FEEDS.addFromURI();

// Get the data once document is fully loaded
document.onload = FEEDS.refresh();


// vim: ts=2:sw=2
