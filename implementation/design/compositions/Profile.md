# Profile

A signed-in reader can [view their profile](reaction:Profile.View), which pairs
[every criterion](former:Profile.CriteriaList) with
[the weights the reader has given](former:Profile.WeightList). A criterion the reader hasn't
weighted counts as 0.

```endpoints
Profile.View at /profile/view
```

A reader can [weight a criterion](reaction:Profile.Weigh) from 0 to 5, which declares that
weight in Recommending. The weight does two things. It raises or lowers how much the criterion
counts in the reader's ranked feed, alongside what Recommending learns from their swipes. And a
criterion weighted above 0 is one the reader cares about, so it is drawn on the radar of every
book card they see. A weight of 0 takes the criterion off their radar without forgetting what
their swipes taught.

```endpoints
Profile.Weigh at /profile/weigh
```
