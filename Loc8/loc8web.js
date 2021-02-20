
// extend Loc8 for web pages
//Loc8.onPageLoadImpl = (paramObj) =>
Loc8.onInit.unshift( (paramObj) =>
{
  // Read params from query string
  const paramStr = decodeURIComponent(location.search.substring(1));

  if(paramStr)
    paramObj = JSON.parse('{"' + paramStr.replace(/=/g, '":"').replace(/&/g, '","') + '"}');

  return (paramObj);
});

Loc8.setInputValue = (elementName, value) =>
{
  const element = document.getElementById(elementName);
  if(element)
  {
    // make sure it's an INPUT type
    if('INPUT' == element.nodeName)
    {
      console.log(elementName + '\t' + element.type + '\t' + value);
      // Logic differs depending on type of input
      switch(element.type.toLowerCase())
      {
        case 'checkbox':  element.checked = value; break;
        default:          element.value   = value; break;
      }
    }
  }
}
Loc8.setDateTimeInputValue = (elementName, value) =>
{ if(value) Loc8.setInputValue(elementName, value.toJSON().substr(0,16)) }

Loc8.onInit.push((paramObj) =>
{
  // Iterate through paramObjs
  Object.keys(paramObj).forEach((key) => { Loc8.setInputValue(key, paramObj[key]) } );

});
Loc8.postInit.push(() =>
{
  // startDate & endDate
  new Array('startDate','endDate').forEach((param) =>
  {
    if(Loc8[param])     Loc8.setDateTimeInputValue(param, Loc8[param]);
  });

  // liveUpdate must be false if endDate is in the past
  if(Loc8.endDate)
  {
    if(Loc8.endDate.getTime() < new Date().getTime())
    {
      Loc8.liveUpdate = false;
    }
  }
  Loc8.setInputValue('liveUpdate', Loc8.liveUpdate);
});

window.onload = Loc8.init;


Loc8.toggleDisplay = (elementId) =>
{
  const style = document.getElementById(elementId).style;
  style.display = ('block' == style.display) ? 'none' : 'block';
}

Loc8.onChange = (element, value) =>
{
  console.log(element + '\t' + value);
  Loc8[element] = value;
  switch(element)
  {
    case 'liveUpdate':
      Loc8.feed.forEach((feed) => {if(feed.setLiveUpdate)  feed.setLiveUpdate(value)});
      // If liveUpdate just set, then force endDate to be null
      if(liveUpdate)
      {
        Loc8.setInputValue('endDate', null);
        //Loc8.onChange('endDate', null);
      }
      break;


    case 'endDate':
      // If setting a real endDate, we must also anull liveUpdate
      if(value)
      {
        Loc8.setInputValue('liveUpdate', false);
        //Loc8.onChange('liveUpdate', false);
      }
      // Deliberate fall through for a change to endDate
    case 'startDate':
      if(value)
      {
        Loc8[element] = new Date(value);

        //Loc8.update();
      }
      break;
  }
}

// Create a table row for each fix
Loc8.fixProcessors.push((fix) =>
{
  var cell;

  fix.row  = document.createElement('tr');
  fix.row.classList.add('fix');

  cell = document.createElement('td');
  cell.innerText = fix.timestamp.toLocaleString();
  fix.row.appendChild(cell);

  cell = document.createElement('td');
  cell.innerText = fix.gridRef ? fix.gridRef : fix.latitude + ',' + fix.longitude;
  if(Loc8.fixLink)
  {
    // Change location to a link
    link           = document.createElement('input');
    link.type      = 'button';
    link.onclick   = () => {
      console.log(fix);
      Loc8.fixLink(fix);
    }
    link.value     = cell.innerText;
    cell.innerText = '';
    /*
    link           = document.createElement('a');
    link.href      = Loc8.fixLink(fix);
    link.innerText = cell.innerText;
    cell.innerText = '';
    */

    cell.appendChild(link);
  }
  fix.row.appendChild(cell);

  cell = document.createElement('td');
  if(fix.alarm)
  {
    fix.row.classList.add(fix.alarm);
    cell.innerText = fix.alarm;
  }
  else
    cell.innerText = fix.batteryLevel ? fix.batteryLevel : '';

  fix.row.appendChild(cell);
})

// Table of plots
trackDevice.prototype.plotTable = (device) =>
{
  const tbdiv = document.createElement('div');
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const thead = document.createElement('thead');
  tbdiv.classList.add('plotTable');
  tbdiv.appendChild(table);
  table.appendChild(thead);
  table.appendChild(tbody);

  var row ;
  var cell;
  var link;

  // Header information
  row  = document.createElement('tr');
  cell = document.createElement('th');
  cell.colspan   = '2';
  cell.innerText = device.name;
  row.appendChild(cell);
  cell = document.createElement('td');
  cell.innerText = Loc8Class.distance(device.fix, 1000).toPrecision(2) + ' km';
  row.appendChild(cell);
  cell = document.createElement('td');
  if(device.status)
    cell.innerText = device.status;
  row.appendChild(cell);
  thead.appendChild(row);

  // Fixes
  device.fix.forEach((fix) =>
  {
    tbody.appendChild(fix.row);
  });

  return tbdiv;
}

// Table of alerts
Loc8.alertTable = (options = {}) =>
{
  const table = document.createElement('table');

  Object.keys(options).forEach((key) =>
  {
    table[key] = options[key];
  })

  Loc8.devices.forEach((device) =>
  {
    device.fix.filter((fix) => { return fix.alarm } ).forEach((fix) =>
    {
      table.appendChild(fix.row.cloneNode(true));
    })
  });

  return table;
}

Loc8.onUpdate.push(()=>
{
  var alertTable = document.getElementById('alertTable');
  if(alertTable)
    alertTable.innerHTML = Loc8.alertTable({ id : alertTable.id, classList: alertTable.classList }).innerHTML;
});

// Download data
Loc8.download = (data, options={}) =>
{
  const link = document.createElement('a');

  link.download = options.filename ? options.filename : true;
  link.href     = 'data:'
                + (options.format ? options.format : 'text/xml')
                + ';charset='+ (options.charset ? options.charset : 'utf-8')
                + ',' + encodeURIComponent(data);

  if(document.createEvent)
  {
    var clickEvent= document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    link.dispatchEvent(clickEvent);
  }
  else if(link.click)
    link.click();
}
