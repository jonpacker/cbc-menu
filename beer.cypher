MATCH (b:beer)
with b, case when b.beeradvocate > 0 then b.beeradvocate else null end as ba_r, case when b.ba_wants > 0 then b.ba_wants else null end as baw_r
with stdev(b.untappd) as ut_std, avg(b.untappd) as ut_av, stdev(b.ratebeer) as rb_std, avg(b.ratebeer) as rb_av, stdev(ba_r) as ba_std, avg(ba_r) as ba_av, max(baw_r) as baw_max
match (b:beer)--(br:brewery)
with br,b, 
[0, case when b.untappd is null then null else ((b.untappd - ut_av)/ut_std) end, 
case when b.beeradvocate is null then null else ((b.beeradvocate - ba_av)/ba_std) end, 
case when b.untappd is null then null else ((b.ratebeer - rb_av)/rb_std) end
] as ratings,
case when b.trade then 0.2 else 0 end as trade_mod,
case when b.acronym then 0.05 else 0 end as acro_mod,
(case when b.ba_wants > 0 then sqrt(b.ba_wants) else 0 end)/sqrt(baw_max) * 1 as baw_mod
with br,b,ratings, ratings as bu_r, trade_mod + acro_mod + baw_mod as hype_score
unwind ratings as rating
with br, b, rating, bu_r, hype_score
match (b)--(superstyle:superstyle), (b)--(metastyle:metastyle), (b)--(session:session), (b)--(style:style)
where rating is not null 
return b as beer, br.name as brewery, superstyle.name as superstyle, metastyle.name as metastyle, avg(rating) as avg_score, hype_score, session.color as session, style.name as style
