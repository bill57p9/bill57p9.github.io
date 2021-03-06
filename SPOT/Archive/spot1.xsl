<?xml version='1.0' encoding='UTF-8'?>
<xsl:stylesheet version='1.0' xmlns:xsl='http://www.w3.org/1999/XSL/Transform'>

<xsl:template match="response/feedMessageResponse">
	<html>
		<body>
			<table>
				<tr>
					<th>Tracker</th>
					<th>Timestamp</th>
					<th>Location</th>
					<th>Message</th>
				</tr>
				<xsl:for-each select='messages/message'>
					<xsl:sort select='dateTime'/>
					<tr>
						<td><xsl:value-of select="messengerName"/></td>
						<td><xsl:value-of select="dateTime"/></td>
						<td>
							<xsl:value-of select="latitude"/><br/>
							<xsl:value-of select="longitude"/>
						</td>
						<td><xsl:value-of select="messageType"/></td>
					</tr>
				</xsl:for-each>
			</table>
		</body>
	</html>
</xsl:template>
</xsl:stylesheet>
