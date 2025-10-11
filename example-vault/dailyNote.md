---
Created: <%tp.date.now("YYYY-MM-DD HH:mm")%> <%tp.date.now("X")%>
workflow_path: "%"
time_start_placeholder_tag: BEG
time_stop_placeholder_tag: END
activity_template: "- #{{emoji}} {{time}} {{workflow_metadata }} ^id-{{id}}\\n\t- :PROPERTIES: %% fold %%\\n\t\t- :BEGAN: {{begin_time }}\\n\t\t- :ENDED: {{end_time }}\\n\t- {{notes}}"
---

# Timeline
