class traccar extends trackProvider
{
  //static get keys() { return ['uri','token','devices'] }
  constructor(params)
  {
    var paramObj = params;
    if('string' == typeof(paramObj))
    {
      var paramArray = paramObj.split(';');
      var paramObj   = {};
      paramObj.uri   = paramArray.shift();
      paramObj.token = paramArray.shift();
      paramObj.devices = paramArray;
    }

    // If URI is relative, reconstruct absolute
    if('/' == paramObj.uri.charAt(0))
      paramObj.uri = location.origin + paramObj.uri;

    // Get URL object representation
    paramObj.url = new URL(paramObj.uri);

    // parameter is traccar root, rather than the API itself
    paramObj.url.pathname += '/api/';

    super(paramObj);

    this.status = "-";

    // Create devices
    const Provider = this;
    paramObj.devices.forEach((deviceId) =>
    {
      Provider.device[deviceId] = new traccarDevice(deviceId, Provider, paramObj);
    });

    // Establish session cookie
    this.apiCall('session','onSessionCookieRx', [ ['token', this.param.token ] ]);

    // Calculate the WS: URL
    paramObj.ws_url          =  new URL(paramObj.url);
    paramObj.ws_url.protocol =  'http' == paramObj.url.protocol ? 'ws' : 'wss';
    paramObj.ws_url.pathname += 'socket';

    console.log(paramObj);
  }

  static get endDateDefault() { return new Date('2100-01-01T00:00:00Z') }
  static endDate(date) { return (null === date ? traccar.endDateDefault : date ) }

  onSessionCookieRx()
  {
    // Get device info
    this.apiCall('devices', 'onDeviceRx');
  }
  onDeviceRx(deviceInfo)
  {
    const Provider = this;
    deviceInfo.forEach((traccarDev) =>
    {
      const localDev = Provider.device[traccarDev.id];
      if(localDev)
      {
        const properties = [ 'name', 'status' ];
        properties.forEach((property) => { localDev[property] = traccarDev[property] } );
        traccarDev.lastUpdate = new Date(traccarDev.lastUpdate);
      }
    });
  }

  // Return a JSON date format string
  static JSONdate(date)
  {
  	switch(typeof(date))
  	{
  		case 'object':
  			return JSON.stringify(date).substr(1,24);
  		default:
  			return date;
  	}
  }

  update(options={})
  {
    var apiOptions =
    [
        [ 'from', traccar.JSONdate(options.startDate)],
        [ 'to'  , traccar.JSONdate(traccar.endDate(options.endDate)) ]
    ];

    Object.keys(this.device).forEach((deviceId) =>
    { apiOptions.push(['deviceId',deviceId]) });

    this.apiCall('reports/route', 'onRouteRx', apiOptions);

    //console.log(options);
    // Startup web socket if applicable
    //if(null === options.endDate && !this.webSocket)
    //  this.startWebSocket();
    this.setLiveUpdate();
  }

  // Open or close webSocket, or skip if no change
  // Uses Loc8.liveUpdate by default
  setLiveUpdate(connect = Loc8.liveUpdate)
  {
    connect ? this.startWebSocket() : this.closeWebSocket();
  }

  // Set up real time connection
  startWebSocket()
  {
    // skip if already connected
    // TODO: Check status
    if(this.webSocket)  return;

    const Feed = this;

    console.log('Starting WebSocket ', this.param.ws_url.href);
    this.webSocket = new WebSocket(this.param.ws_url.href);

    // Set feed status on connect
    this.webSocket.onopen = function(event)
    {
      console.log('WebSocket connected ', new Date().toLocaleString());
      Feed.status='live';
    }

    // Set feed status on disconnect
    this.webSocket.onclose = function(event)
    {
      console.log('WebSocket disconnected ', new Date().toLocaleString());
      Feed.status='-';
      console.log(this);
      // TODO: Reconnect
    }

    // Set feed status on disconnect
    this.webSocket.onerror = function(event)
    {
      console.error('WebSocket Error: ', event);
      Feed.status('error');
    }

    // Rx message event
    this.webSocket.onmessage = function (rx)
    {
      const data = JSON.parse(rx.data);
      console.log(data);

      if(data.positions)  Feed.onRouteRx(data.positions);
      if(data.devices)    Feed.onDeviceRx(data.devices);

    }
  }

  closeWebSocket()
  {
    if(this.webSocket)
      this.webSocket.close();
    this.webSocket = null;
  }

  apiCall(method, callback, params=[])
  {
    var url      =  new URL(this.param.url);
    url.pathname += method;
    //url.search   =  '?token=' + this.param.token;
    params.forEach((param) =>
    {
      if(1<url.search.length)
        url.search += '&';
      url.search += param[0] + '=' + param[1];
    });

    const call = new asyncJSON
    ({
      uri     : url.href,
      feedId  : this.id,
      callback: callback
    });
    return call;
  }

  onRouteRx(fixes)
  {
    const Provider = this;
    fixes.forEach((fix) =>
    {
      const Device = Provider.device[fix.deviceId];
      if(Device)
      {
        fix.timestamp = new Date(fix.fixTime);
        if('undefined' != typeof(fix.attributes.batteryLevel))
          fix.batteryLevel = fix.attributes.batteryLevel;
        if(fix.attributes.alarm) fix.alarm = fix.attributes.alarm;
        delete fix.attributes;
        Device.addFix(fix);
      }
    });

    Loc8.updated(fixes);
  }
}

class traccarDevice extends trackDevice
{
}

Loc8.trackProvider.traccar = traccar;
//console.log(encodeURIComponent('https://arvell.duckdns.org/traccar'));
