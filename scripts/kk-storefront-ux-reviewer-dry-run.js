'use strict';

const Reviewer=require('../server/kk-storefront-ux-reviewer.js');

const report=Reviewer.auditStorefront({
  platform:'ios',
  viewport:{width:390,height:844},
  metrics:{
    document_scroll_width_px:390,
    content_width_px:390,
    sticky_controls_height_px:126,
    bottom_cta_height_px:56,
    bottom_cta_fixed:true,
    safe_area_bottom_applied:true,
    min_form_control_font_px:16,
    filter_rows:1,
    card_columns:2,
    card_min_width_px:172,
    visible_event_cards_above_fold:1,
    tap_targets:[
      {id:'search',width:370,height:44},
      {id:'month',width:118,height:44},
      {id:'all',width:82,height:44},
      {id:'available',width:72,height:44},
      {id:'waitlist',width:82,height:44}
    ]
  }
});

process.stdout.write(JSON.stringify(report,null,2)+'\n');
