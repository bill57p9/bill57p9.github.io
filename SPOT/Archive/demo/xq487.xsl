<?startSampleFile ?>
<!-- xq487.xsl: converts xq484.xml into xq493.xml -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
     version="1.0">
  <xsl:output method="text"/>

<xsl:variable name="colorLookupDoc" select="document('xq485.xml')"/>

<xsl:key name="colorNumKey" match="color" use="@cid"/>

<xsl:template match="shirts">
  <xsl:apply-templates select="$colorLookupDoc"/>
  <xsl:apply-templates/>
</xsl:template>

<xsl:template match="colors"/>

  <xsl:template match="shirt">
    <xsl:variable name="shirtColor" select="@colorCode"/>
    <xsl:for-each select="$colorLookupDoc">
      <xsl:value-of select="key('colorNumKey',$shirtColor)"/>
    </xsl:for-each>
    <xsl:text> </xsl:text><xsl:apply-templates/><xsl:text>
</xsl:text>
  </xsl:template>

</xsl:stylesheet>
<?endSampleFile ?>
