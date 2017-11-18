// Create new SPOT_TRACKER
// Note that we must have one message, so we start the array
function SPOT_TRACKER(message)
{
	this.id=message.messengerId;
	this.name=message.messengerName;
	this.type=message.modelId;
	this.message=new Array();
	this.message.push(new SPOT_MESSAGE(message));
}


SPOT_TRACKER.prototype = new TRACKER();
SPOT_TRACKER.prototype.constructor = SPOT_TRACKER;

// SPOT_MESSAGE represents a single SPOT message
// It inherits from GT_WGS84 to give geo (& OSGB) functionality
function SPOT_MESSAGE(message)
{
	this.id=message.id;
	this.type=message.messageType;
	this.time=new Date(message.unixTime * 1000);
	this.battery=message.batteryState;
	this.latitude=message.latitude;
	this.longitude=message.longitude;
}
SPOT_MESSAGE.prototype = new TRACKER_MESSAGE();
SPOT_MESSAGE.prototype.constructor = SPOT_MESSAGE;


// SPOT_FEED object - inherits from FEED object
function SPOT_FEED(id)
{
	this.type	="SPOT";
	this.id		= id.valueOf();
	this.addMessage = function(message)
	{
		var msg=new SPOT_MESSAGE(message);
		// Look to see if we "know" the messenger
		var tracker=this.getTracker(message.messengerId);
		if(!tracker)
			this.tracker.push(new SPOT_TRACKER(message));
		else 
		{
			// Check that we don't already have the message
			for(var ix=0; ix<tracker.message.length; ix++)
				if(tracker.message[ix].id == msg.id)
					return false;

			tracker.message.unshift(msg);
		}
	};
	this.getFeedMessages = function(startDate, endDate, callback)
	{
		// Default endDate is 7 days after startDate
		endDate = new Date(endDate ? endDate : startDate.getTime() + (7 * 24 * 60 * 60 * 1000))

		var url="https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/"+ this.id
			+ "/message.json?startDate=" + startDate.toJSON().substr(0,19)
			+ "-0000&endDate=" + endDate.toJSON().substr(0,19) + "-0000";

		console.log(url);

		if(this.id == 0)	// handle sample JSON
			url="sample/SPOT.jsonp";


		this.lastUpdated=new Date();
		J50Npi.getJSON(url, this.json, function(json)
		{
			var response=json.response.feedMessageResponse;
			// search for FEED that this response applies to
			var fed = FEEDS.getFeed("SPOT", response.feed.id);
			fed.name = response.feed.name;
			fed.description = response.feed.description;
			for(var ix=response.messages.message.length-1; ix>-1 ; ix--)
			{
				fed.addMessage(response.messages.message[ix]);

				var msgTime = new Date(response.messages.message[ix].unixTime*1000);
				if(!fed.earliestMessage || fed.earliestMessage>msgTime)
					fed.earliestMessage = msgTime;
				if(!fed.latestMessage || fed.latestMessage<msgTime)
					fed.latestMessage = msgTime;
			}
		
			// And finally do another callback
			if(callback)
				callback(fed);
		});
	};
}
SPOT_FEED.prototype = new FEED();
SPOT_FEED.prototype.constructor = SPOT_FEED;

// Register SPOT_FEED with FEEDS
FEEDS.addProvider("SPOT",SPOT_FEED);

// vim: ts=2:sw=2
