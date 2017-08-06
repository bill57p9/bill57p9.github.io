<?xml version='1.0' encoding='UTF-8'?>
<xsl:stylesheet version='1.0' xmlns:xsl='http://www.w3.org/1999/XSL/Transform'>
	<xsl:output method='html' indent='yes'/>

<xsl:template match='/'>
	<html>
		<body>
			<script language="javascript" src="http://www.nearby.org.uk/tests/geotools2.js"/>
			<table border='1'>
				<tr>
					<th>Tracker</th>
					<th>Timestamp</th>
					<th>Location</th>
					<th>Status</th>
				</tr>
	<xsl:for-each select="document(feed/@source)">
		<xsl:apply-templates/>
	</xsl:for-each>
			</table>
		</body>
	</html>
</xsl:template>

<xsl:template match='response/feedMessageResponse'>
				<xsl:for-each select='messages/message'>
					<xsl:sort select='messengerName'/>
					<xsl:sort select='unixTime'/>
					<tr>
						<td><xsl:value-of select="messengerName"/></td>
						<td>
							<script>
								DAYS=new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");
								ts=new Date(<xsl:value-of select="unixTime"/>*1000);
								document.write(
									DAYS[ts.getDay()]+" "+
									ts.toLocaleTimeString());
							</script>
						</td>
						<td>
							<a id="{id}">
								<script>
									wgs84=new GT_WGS84();
									wgs84.setDegrees(
										<xsl:value-of select="latitude"/>,
										<xsl:value-of select="longitude"/>);
									osgb=wgs84.getOSGB();
									document.write(osgb.getGridRef(3));
									document.getElementById(<xsl:value-of select="id"/>).href=
										"http://www.streetmap.co.uk/newprint.srf?"+
										"x="+osgb.eastings+"&amp;"+
										"y="+osgb.northings+"&amp;"+
										"z=4&amp;"+
										"ar=Y";
								</script>
							</a>
						</td>
						<td>
							<img src="{messageType}.png" alt="{messageType}"/>
							<img src="battery_{batteryState}.png" alt="Battery {batterState}"/>
						</td>
					</tr>
				</xsl:for-each>
</xsl:template>
</xsl:stylesheet>

<!-- vim: ts=2:sw=2 -->
