MATCH (beer:beer)--(brewery:brewery), (beer)--(session:session)
WHERE beer.deleted IS NULL or beer.deleted <> true
OPTIONAL MATCH (beer)--(superstyle:superstyle), (beer)--(metastyle:metastyle)
RETURN beer, 
       brewery.location as location,
       brewery.name as brewery, 
       superstyle.name as superstyle, 
       metastyle.name as metastyle, 
       session.color as session
