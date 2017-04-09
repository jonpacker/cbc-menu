MATCH (beer:beer)--(brewery:brewery), (b)--(session:session)
OPTIONAL MATCH (b)--(superstyle:superstyle), (b)--(metastyle:metastyle)
RETURN beer, 
       brewery.name as brewery, 
       superstyle.name as superstyle, 
       metastyle.name as metastyle, 
       session.color as session,
       style.name as style
