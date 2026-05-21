import json


def main(display_data):
    if isinstance(display_data, str):
        display_dict = json.loads(display_data)
    elif isinstance(display_data, dict):
        display_dict = display_data
    else:
        raise TypeError("display_data must be a dict or JSON string")

    applicant_name = display_dict["applicant_name"]
    applicant_cn_type = display_dict["applicant_cn_type"]
    kbn_name = display_dict["kbn_name"]
    operations_cn_name = display_dict["operations_cn_name"]
    expiration = display_dict["expiration"]

    apply_title = f"{applicant_cn_type}'{applicant_name}'申请‘{kbn_name}’的{operations_cn_name} 权限"
    if len(apply_title) > 200:
        apply_title = f"{applicant_name}:{kbn_name}"
    
    return applicant_name, applicant_cn_type, kbn_name, operations_cn_name, expiration, apply_title