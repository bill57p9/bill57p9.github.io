
// Define track palettem for devices
Loc8map=
{
  devicePalette :
  [
    { color: 'red'   },
    { color: 'green' },
    { color: 'blue'  }
  ],
  mouseMove : [],
  follow   : true,
  onChange : (element, value) =>
  {
    switch(element)
    {
      case 'follow':
      default:  return Loc8.onChange(element, value);
    }
    Loc8.setInputValue(element, value);
  }
}
// Set global palette parameters
Loc8map.devicePalette.forEach((palette) =>
{
  palette.track =
  {
    color    : palette.color,
    weight   : 10,
    opacity  : 0.5
  }

  palette.fix   =
  {
    radius   : 5,
    color    : palette.color,
    weight   : 1,
    opacity  : 0.1
  }

  palette.fixCurrent =
  {
    radius   : 20,
    color    : palette.color,
    weight   : 5,
    opacity  : 0.8
  }
})

Loc8.follow = true;

// Extend Leaflet to offer a textbox control
L.Control.textbox = L.Control.extend
({
  onAdd: (map) => {},
  onRemove: (map) => {}  // Nothing to do here
});
L.control.textbox = (opts) => { return new L.Control.textbox(opts);}

// Extend Leaflet polyline to calculate length
L.Polyline = L.Polyline.include
({
  getDistance: function(metres = 1)
  {
    // distance in meters
    var mDistance = 0,
    length = this._latlngs.length;
    for (var i = 1; i < length; i++)
      mDistance += this._latlngs[i].distanceTo(this._latlngs[i - 1]);

    return mDistance / metres;
  }
});

// Define object for map providers to be registered
Loc8.mapProvider = {};

Loc8.onInit.push((params) =>
{
  console.log(Loc8.mapProvider);

  // Process parameters that are for the web element
  Object.keys(params).forEach((param) =>
  {
    const value = params[param];
    switch (param)
    {
      case 'map':
        Loc8.mapProvider = Loc8.mapProvider[value];
        delete params[param];
        break;
      case 'follow':
        Loc8map.follow   = value;
        delete params[param];
        break;
    }
  });
})


// Map initialisation routine
Loc8.onInit.push( () =>
{
  Loc8.map = L.map('map', Loc8.mapProvider.options);

  // Load and display ZXY tile layer on the map.
  L.tileLayer(Loc8.mapProvider.uri).addTo(Loc8.map);

  // Add textbox
  const textbox = L.control.textbox({ position: 'topright' });
  textbox.onAdd = (map) =>
  {
    //var textbox = L.DomUtil.create('div');
    var textbox   = L.DomUtil.create('a');
    textbox.id    = 'mapTextBox';
    textbox.class = 'mapTextBox';
    //textbox.onclick = () => alert('hello');
    textbox.href  = 'javascript:Loc8.toggleDisplay("Settings")';
    textbox.innerText = 'Settings'
    return textbox;
  }
  textbox.addTo(Loc8.map);

  // Add alert textbox
  const alertBox = L.control.textbox({ position: 'bottomright'} );
  alertBox.onAdd = (map) =>
  {
    const table = L.DomUtil.create('table');
    table.id    = 'alertTable';
    return table;
  }
  alertBox.addTo(Loc8.map);

  // Add functions to Loc8.map
  Loc8.map.fixToLatLng = (fix) => { return new L.LatLng(fix.latitude, fix.longitude) }
  Loc8.map.recentre    = (latitude,longitude) =>
  {
    Loc8.map.setView
    (
      L.latLng(latitude, longitude), // Center
      Loc8.map.getZoom(),
      { pan : 'animate' }
    );
  }

  // Trigger onMouseMove events
  Loc8.map.on('mousemove', (event) =>
  {
    Loc8map.mouseMove.forEach((mouseMove) => { mouseMove(event) } )
  });

  // Add map centering on update
  Loc8.onUpdate.push( () =>
  {
    const midPoint = Loc8.lastMidPoint();

    // Recenter on update, if selected
    if(Loc8.follow)
      Loc8.map.recentre(midPoint.latitude, midPoint.longitude);

    console.log(Loc8);
  });

});

// Update follow on init
Loc8.postInit.push(() =>
{
  Loc8.setInputValue('follow', Loc8.follow);
});


// Set fix link to recentre the map
Loc8.fixLink = (fix) =>
{
  Loc8.map.recentre(fix.latitude, fix.longitude);
  //return 'javascript:Loc8.map.recentre(\'' + fix.latitude + '\',\'' + fix.longitude + '\')';
}

// Track updates
Loc8.onUpdate.push(() =>
{
  Loc8.devices.forEach((device) =>
  {
    // Nothing to do if no fixes
    if(device.fix.length)
    {
      // Update track
      const latLngs = device.fix.map(Loc8.map.fixToLatLng);

      if(device.track)
        device.track.setLatLngs(latLngs);
      else
      {
        device.track = L.polyline(latLngs,device.palette.track).addTo(Loc8.map);
        device.track.bindPopup('',{maxWidth: 500});
      }

      // Update popup content
      const popupContent = document.createElement('div');
      //popupContent.classList.add('plotTable');
      popupContent.appendChild(device.plotTable(device));
      device.track.setPopupContent(popupContent);

      device.fix.forEach((fix) => fix.marker.setPopupContent(popupContent));

      // Create current position marker if not already defined
      if(device.marker)
        device.marker.removeFrom(Loc8.map);
      else
        device.marker = L.circleMarker([0,0], device.palette.fixCurrent );

      // position "current" fix if device is online
      if('online' == device.status)
      {
        device.marker.setLatLngs(Loc8.map.fixToLatLng(device.lastFix()));
        device.marker.addTo(Loc8.map);
      }
    }
    else
      alert('No fixes found in given timeframe for ' + device.name);
  });
});
Loc8.fixProcessors.push((fix, device) =>
{
  // Make sure we have a palette for the device
  if(!device.palette)
  {
    device.palette = Loc8map.devicePalette.shift();
    console.log(device);
  }

  fix.marker = L.circleMarker(Loc8.map.fixToLatLng(fix), device.palette.fix );
  /*
  var toolTip = fix.timestamp.toLocaleString();
  if(fix.gridRef)
    toolTip += ' ' + fix.gridRef;
  if(fix.batteryLevel)
    toolTip += ' ' + fix.batteryLevel;

  fix.marker.bindTooltip(toolTip);
  */
  fix.marker.bindTooltip(fix.row);
  fix.marker.bindPopup('',{maxWidth:500});
  fix.marker.addTo(Loc8.map);
});

// Work out the mid point of latest data
Loc8.lastMidPoint = () =>
{
  var fixes = [];
  Loc8.devices.forEach((device) =>
  {
    const lastFix = device.lastFix();
    if(lastFix)
      fixes.push(lastFix);
  })

  const result = Loc8Class.midPoint(fixes);
  return result;
}
