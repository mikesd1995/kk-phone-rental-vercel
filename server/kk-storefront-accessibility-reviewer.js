'use strict';
const VERSION='KK_STOREFRONT_ACCESSIBILITY_REVIEWER_V1';
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function review(input={}){
 const m=input.metrics||{},findings=[],add=(code,severity,evidence,recommended_action,acceptance_test)=>findings.push({code,severity,evidence,recommended_action,acceptance_test});
 const small=(Array.isArray(m.tap_targets)?m.tap_targets:[]).filter(x=>n(x.width)>0&&n(x.height)>0&&(n(x.width)<44||n(x.height)<44));
 if(small.length)add('A11Y_TAP_TARGET','P1',small.length+' interactive target(s) below 44px.','Increase hit boxes to at least 44x44px.','All supplied primary targets are >=44x44px.');
 if(/ios/i.test(String(input.platform||m.platform||''))&&n(m.min_form_control_font_px)>0&&n(m.min_form_control_font_px)<16)add('A11Y_IOS_ZOOM','P1','iOS form control font below 16px.','Use >=16px input/select text.','Minimum iOS form-control font is >=16px.');
 if(n(m.document_scroll_width_px)>n(m.viewport_width_px)+1)add('A11Y_HORIZONTAL_OVERFLOW','P1','Document exceeds viewport width.','Contain overflowing controls/content.','No horizontal document overflow.');
 return {schema_version:VERSION,agent:'kk-storefront-accessibility-reviewer',dimension:'accessibility',status:findings.length?'REVISE':'PASS',findings,production_writes:0};
}
module.exports={VERSION,review};