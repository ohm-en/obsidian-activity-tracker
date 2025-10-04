---
Created: <%tp.date.now("YYYY-MM-DD HH:mm")%> <%tp.date.now("X")%>
workflow_path:
  - "%"
activity_regex: "- #(\\S+) (==\\d\\d:\\d\\d==-==\\d\\d:\\d\\d==) (\\(.{0,2}\\s+.*\\)+)\\s+\\^id-(\\d{1,})\\n\\s- :PROPERTIES:\\n\\s\\s- :BEGAN: (\\d{10}|#BEG)\\n\\s\\s- :ENDED: (\\d{10}|#END)(?:\\n\\s- (.*))?((?:\\n\\s{2,}- .*)*)?"
activity_group_matchings:
  - raw
  - emoji
  - time
  - workflow_metadata
  - id
  - begin_time
  - end_time
  - notes
  - extra_notes
---

# <%tp.date.now("dddd")%>'s Timeline
