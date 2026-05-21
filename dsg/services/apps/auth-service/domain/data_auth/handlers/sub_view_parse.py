import json
import logging

def main(display_data):
    logging.warning("display_data: %r", display_data)
    if isinstance(display_data, str):
        display_dict = json.loads(display_data)
    elif isinstance(display_data, dict):
        display_dict = display_data
    else:
        raise TypeError("display_data must be a dict or JSON string")

    applicant_name = display_dict["applicant_name"]
    applicant_cn_type = display_dict["applicant_cn_type"]
    datasource_name = display_dict["datasource_name"]
    data_view_name = display_dict["data_view_name"]
    column_rules = display_dict["column_rules"]
    row_rules = display_dict["row_rules"]
    operations_cn_name = display_dict["operations_cn_name"]
    expiration = display_dict["expiration"]

    apply_title = f"{applicant_cn_type}'{applicant_name}'申请‘{datasource_name}’的‘{data_view_name}’行列规则的权限"
    if len(apply_title) > 200:
        apply_title = f"{applicant_name}:{data_view_name}"
    
    return applicant_name, applicant_cn_type, datasource_name, data_view_name, column_rules, row_rules, operations_cn_name, expiration, apply_title