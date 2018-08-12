// local.js
// Supports local feed by HTML5 geolocation
// works as a single tracker within a feed




// LOCAL_FEED object - inherits from FEED object
function LOCAL_FEED(id)
{
	this.id		= id;
	this.tracker.push(new TRACKER());
	this.getFeedMessages = function(startDate, endDate, callback)
	{
		// We can't get history from HTML5, so check that "now" is within filter
		var now = new Date().getTime;
		
		if(startDate && now < startDate.getTime())
			return;
		if(endDate && now > endDate.getTime())
			return;
		
		// Check that browser actually supports geolocation
		if(!navigator.geolocation)
		{
			this.tracker[0].status="Unsupported";
			return false;
		}
		
		navigator.geolocation.getCurrentPosition
		(
			function(position)
			{
				// Callback method for position response
				var feed			= FEEDS.getFeed("local",id);
				var message			= new TRACKER_MESSAGE();
				message.time		= new Date(position.timestamp ? position.timestamp : new Date());
				message.id			= message.time.getTime();
				message.latitude	= position.coords.latitude;
				message.longitude	= position.coords.longitude;
				if(position.coords.altitude)
					message.altitude= position.coords.altitude;
				
				console.log(feed);
				feed.tracker[0].status = "";
				feed.tracker[0].message.push(message);
				if(callback)
					callback(feed);
			},
			function(error)
			{
				// Callback function in case of error
				console.log(error);
				var feed			= FEEDS.getFeed("local",id);
				switch(error.code)
				{
					case error.PERMISSION_DENIED:
						feed.tracker[0].status = "Denied";
						break;
					case error.POSITION_UNAVAILABLE:
						feed.tracker[0].status = "Unavailable";
						break;
					case error.TIMEOUT:
						feed.tracker[0].status = "Timeout";
						break;
					default:
						feed.tracker[0].status = "Error";
				}
				if(callback)
					callback(feed);
			}
		);
	};
}
LOCAL_FEED.prototype = new FEED();
LOCAL_FEED.prototype.constructor = LOCAL_FEED;
LOCAL_FEED.prototype.type		= "local";

// Register provider
FEEDS.addProvider("local", LOCAL_FEED);



// vim: ts=2:sw=2
