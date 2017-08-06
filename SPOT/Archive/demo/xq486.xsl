<?startSampleFile ?>
<!-- xq486.xsl: converts xq484.xml into xq491.xml -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
     version="1.0">
  <xsl:output method="xml" omit-xml-declaration="yes"/>

  <xsl:template match="shirts">
    <shirts>
      <xsl:apply-templates select="document('xq485.xml')"/>
      <xsl:apply-templates/>
    </shirts>
  </xsl:template>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>
<?endSampleFile ?>
