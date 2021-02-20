
class Loc8Class
{
  constructor()
  {
    this.trackProvider = {};
    this.plotProvider  = {};
    this.fixProcessors = [];
    this.feed          = [];
    this.onInit        = [];
    this.postInit      = [];
    this.onUpdate      = [];
    this.liveUpdate    = true;

    // Set defaults

    // Default start is 0300L this morning (0300L yesterday if before 0500L)
    this.startDate = new Date();
    // Subtract a day for anything prior to 0500L
    if(this.startDate.getHours() < 5)
      this.startDate.setTime(this.startDate.getTime() - (24 * 60 * 60 * 1000));
    this.startDate.setMilliseconds(0);
    this.startDate.setSeconds(0);
    this.startDate.setMinutes(0);
    this.startDate.setHours(3);

    // Default endDate is null (not defined)
    this.endDate = null;
  }

  // Executed when ready for data
  init(params={})
  {
    // Other calls first
    Loc8.onInit.forEach((init) =>
    {
      var newParams = init(params);
      if(newParams)
        params = newParams;
    });

    // Iterate through each parameter
    Object.keys(params).forEach((key)=>
    {
      const value = params[key];
      if(Loc8.trackProvider[key])
        Loc8.feed.push(new Loc8.trackProvider[key](value));
      else
        switch(key)
        {
          case 'from':
          case 'startDate':
            Loc8.startDate = new Date(value);
            break;
          case 'to':
          case 'endDate':
            Loc8.endDate   = new Date(value);
            break;
          case 'live':       Loc8.live      = value;     break;
          default:
            console.log('Unrecognised parameter: ', key);
            break;
        }
    });

    Loc8.postInit.forEach((init) => { init(params) });

    Loc8.update();
    console.log(this);
  }

  // return whether fix is in scope
  isFixTimely(fix)
  {
    // If not defined, then return true
    if(!fix)  return true;

    const  t =   fix.timestamp.getTime();
    if(    t <  this.startDate.getTime())  return false;
    if(null === this.endDate)              return true;
    return t <= this.endDate.getTime() ;
  }

  // get latest data
  update()
  {
    const self = this;
    // Wipe any fixes out of scope
    this.devices.forEach((device) =>
    {
      while(!self.isFixTimely(device.fix[0])) { device.fix.shift(); }
      while(!self.isFixTimely(device.fix[device.fix.length-1])) { device.fix.pop(); }
    });

    // Read data
    var options =
    {
      startDate : this.startDate,
      endDate   : this.endDate
    }
    this.feed.forEach((trackProvider) => { trackProvider.update(options) } );
  }

  // Work through having received an Update
  updated(data)
  {
    Loc8.devices.forEach((device)  => { device.sortFixes(); })
    Loc8.onUpdate.forEach((update) => { update(data) } );
  }

  // Return array of all devices across all feeds
  get devices()
  {
    var result = [];
    this.feed.forEach((feed) =>
    {
      Object.keys(feed.device).forEach((device) => { result.push(feed.device[device]) });
    })
    return result;
  }

  get gpx()
  {
    var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
    gpx    += '<gpx xmlns="http://www.topografix.com/GPX/1/1">\n';
    // TODO: Metadata
    this.devices.forEach((device) =>
    {
      gpx  += '\t<trk>\n';
      gpx  += '\t\t<name>' + device.name + '</name>\n';
      gpx  += '\t\t<trkseg>\n';
      device.fix.reverse().forEach((fix) =>
      {
        gpx+= '\t\t\t<trkpt lat="' + fix.latitude + '" lon="' + fix.longitude + '">\n';
        if(fix.altitude)
          gpx += '\t\t\t\t<ele>' + fix.altitude + '</ele>\n';
        gpx+= '\t\t\t\t<timestamp>' + fix.timestamp.toJSON().slice(0,19) + 'Z</timestamp>\n';
        gpx+= '\t\t\t</trkpt>\n';
      });
      gpx  += '\t\t</trkseg>\n';
      gpx  += '\t</trk>\n';
    });
    gpx    += '</gpx>';

    return gpx;
  }

  get kml()
  {
    var kml = '<?xml version="1.0" encoding="UTF-8" ?>\n';
    kml    += '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n';
    kml    += '\t<Folder>';
    this.devices.forEach((device) =>
    {
      kml  += '\t\t<Placemark>';
      kml  += '\t\t<name>' + device.name + '</name>\n';
      kml  += '\t\t\t<gx:Track>';
      device.fix.reverse().forEach((fix) =>
      {
        kml+= '\t\t\t\t<when>' + fix.timestamp.toJSON().slice(0,19) + 'Z</when>\n';
      });
      device.fix.reverse().forEach((fix) =>
      {
        kml+= '\t\t\t\t<gx:coord>' + fix.longitude + ' ' + fix.latitude;
        if(fix.altitude)
          kml += ' ' + fix.altitude;
        kml+= '</gx:coord>\n';
      });
      kml  += '\t\t\t</gx:Track>';
      kml  += '\t\t</Placemark>';
      kml  += '\t</Folder>';
    });
    kml    += '</kml>';

    return kml;
  }

  static midPoint(fixes)
  {
    var validFixes = fixes.length;
    var altitudes  = 0;
    var midPoint =
    {
      latitude : 0,
      longitude: 0,
      altitude : 0
    }

    // Average lat & longitude
    // I unsure whether this is correct, but it's good enough for now
    fixes.forEach((fix) =>
    {
      if(fix.isValid)
      {
        midPoint.latitude += fix.latitude;
        midPoint.longitude+= fix.longitude;
        if(fix.altitude)
        {
          ++altitudes;
          midPoint.altitude+= fix.altitude;
        }
      }
      else
        --validFixes;
    });

    midPoint.latitude  /= validFixes;
    midPoint.longitude /= validFixes;

    if(altitudes)
      midPoint.altitude/= altitudes;
    else
      delete midPoint.altitude;

    return midPoint;
  }

  // Calculate distance between ordered fixes
  static distance(fixes, metres=1)
  {
    if(!fixes)
      return null;
    const fixCount = fixes.length;
    if(fixCount < 2)
      return 0;

    const radian = Math.PI/180;
    const R      = 6371e3; // Earth radius in metres
    var distance = 0;
    for(var i=1; i<fixCount; ++i)
    {
      const lat =
      [
        fixes[i-1].latitude * radian,
        fixes[i].latitude   * radian
      ]
      const lon = (fixes[i-1].longitude - fixes[i].longitude) * radian;

      const d = Math.acos( Math.sin(lat[0])*Math.sin(lat[1]) + Math.cos(lat[0])*Math.cos(lat[1]) * Math.cos(lon) ) * R;

      // Add height component, if valid
      if(isFinite(d))
        distance += ((fixes[i-1].altitude && fixes[i].altitude)
         ? Math.sqrt((d**2)+((fixes[i-1].altitude - fixes[i].altitude)**2))
         : d );
    }
    return distance/metres;
  }
}

const Loc8 = new Loc8Class();

// Add fix functions
Loc8.fixProcessors.push((fix) =>
{
  fix.isValid = true;
  if
  ( fix.latitude < -90   || fix.latitude  > +90 ||
    fix.longitude < -180 || fix.longitude > +180 )
    fix.isValid = false;

  if(!fix.latitude && !fix.longitude && !fix.altitude)
    fix.isValid = false;

  // Suffix % on batteryLevel if a number
  if(isFinite(fix.batteryLevel))
    fix.batteryLevel = fix.batteryLevel + '%';
})

class trackProvider
{
  constructor(params={})
  {
    this.param = params;
    this.id    = Loc8.feed.length;
    this.device= {};
  }
  update(options={})
  {
    const trackProvider = this;
    Object.keys(trackProvider.device).forEach((device) =>
    {
      trackProvider.device[device].update(options)
    });
  }
}

class trackDevice
{
  constructor(id, feed, params={})
  {
    this.id    = id;
    this.param = params;
    this.fix   = [];
    this.feed  = feed;
    this.onUpdate=[];
  }

  // Add a fix to the array
  addFix(fix)
  {
    const _trackDevice = this;

    const fixTime = fix.timestamp.getTime();

    // Check that fix timestamp is within search criteria
    // Check for duplicates based on timestamp
    // TODO: Keep this update and dump old fix
    if(Loc8.isFixTimely(fix) && !this.fix.some((item) => { return fixTime == item.timestamp.getTime() }))
    {
      // Run the fix processors
      Loc8.fixProcessors.forEach((processor) => { processor(fix, _trackDevice) });

      this.fix.unshift(fix);

      // Callbacks
      this.onUpdate.forEach((callback) => callback(fix, _trackDevice) );
    }
  }

  // Return last fix
  lastFix()  { return this.fix[0]; }

  // Sort fixes in reverse chronological order
  sortFixes()
  {
    this.fix.sort((b,a) => { return a.timestamp.getTime() - b.timestamp.getTime() })
  }
}

class asyncJSON extends XMLHttpRequest
{
  constructor(params={})
  {
    super();
    console.log(params.uri);

    // Set up callback
    this.onreadystatechange = () =>
    {
      if(this.readyState == 4 && this.status == 200 && params.callback)
      {
        const responseData = JSON.parse(this.responseText);
        console.log(responseData);
        if('undefined' != typeof(params.feedId))
        {
          if('undefined' != typeof(params.deviceId))
            Loc8.feed[params.feedId].device[params.deviceId][params.callback](responseData);
          else
            Loc8.feed[params.feedId][params.callback](responseData);
        }
        else
          params.callback(responseData);
      }
    }

    this.open('GET', params.uri, true);
    this.send();
  }
}
