# Profile

A signed-in reader can [view their profile](reaction:Profile.View), which pairs
[every criterion](former:Profile.CriteriaList), with the meaning of each of its two ends, with
[the reader's preferences](former:Profile.WeightList). A criterion the reader hasn't set has an
importance of 0.

```endpoints
Profile.View at /profile/view
```

Every criterion is a scale between two ends, such as pace from a slow burn to a page-turner,
because "more" isn't better for every quality: some readers want a slow burn. So a reader
[sets a preference](reaction:Profile.Weigh) in two parts: where on the scale they like books to
be, and how much that matters to them, from 0 to 5. This becomes their preference in
Recommending. Books close to where the reader likes them rank higher, in proportion to how much
it matters, alongside what Recommending learns from their swipes. A criterion that matters above
0 is drawn on the radar of every book card they see, next to the reader's own ideal. An
importance of 0 takes it off their radar without forgetting what their swipes taught.

```endpoints
Profile.Weigh at /profile/weigh
```
