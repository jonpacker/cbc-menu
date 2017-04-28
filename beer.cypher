MATCH (beer:beer)--(brewery:brewery), (beer)--(session:session)
OPTIONAL MATCH (beer)--(superstyle:superstyle), (beer)--(metastyle:metastyle)
RETURN beer, 
       brewery.name as brewery, 
       superstyle.name as superstyle, 
       metastyle.name as metastyle, 
       session.color as session
