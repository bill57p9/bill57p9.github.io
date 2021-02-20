// Calculate grid refs for GB & Ireland


class osgb
{
  constructor(params={})
  {
    this.northings = 0;
    this.eastings  = 0;
    if(params.northings)
      this.northings = params.northings;
    if(params.eastings)
      this.eastings  = params.eastings;


  }

  static getGridRef(fix)
  {
    //create a wgs84 coordinate
    var wgs84=new GT_WGS84();

    if(fix.lat)  fix.latitude  = fix.lat;
    if(fix.lng)  fix.longitude = fix.lng;
    wgs84.setDegrees(fix.latitude, fix.longitude);

    //convert to OSGB / Irish
    var os = null
    if(wgs84.isGreatBritain())
      os   = wgs84.getOSGB();
    else if(wgs84.isIreland())
      os   = wgs84.getIrish();

    if(os)
    {
      //get a grid reference with 4 digits of precision
      fix.gridRef  = os.getGridRef(4);

      // populate Eastings & Northings
      fix.eastings = os.eastings;
      fix.northings= os.northings;
    }
    return fix;
  }

  static get apiKey()     { return 'HoAAuo3EXmMXPAa8VyVjETAR1v4ukmk2' };
  static get serviceUrl() { return 'https://api.os.uk/maps/raster/v1/zxy'};

  // Setup the EPSG:27700 (British National Grid) projection.
  static get crs() { return new L.Proj.CRS('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs', {
      resolutions: [ 896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75 ],
      origin: [ -238375.0, 1376256.0 ]
    })}

  static uri(mapType)
  {
    return osgb.serviceUrl + '/' + mapType + '/{z}/{x}/{y}.png?key=' + osgb.apiKey;
  }
  static provider(mapType)
  {
    const provider =
    {
      uri : osgb.uri(mapType),
      options :
      {
        crs               : osgb.crs,
        minZoom           : 0,
        maxZoom           : 9,
        zoom              : 7,
        attributionControl: false
      }
    }
    return provider;
  }
}

Loc8.mapProvider.osgbl = osgb.provider('Leisure_27700');

Loc8map.mouseMove.push((event)=>
{
  const textbox = document.getElementById('mapTextBox');
  const gridRef = osgb.getGridRef(event.latlng).gridRef;
  textbox.innerText = gridRef;
  //textbox.innerText +=' ' + event.latlng.latitude + ' ' + event.latlng.longitude;
})
Loc8.fixProcessors.unshift( osgb.getGridRef );
