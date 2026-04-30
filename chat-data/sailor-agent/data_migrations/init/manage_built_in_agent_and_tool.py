"""
本脚本用于管理内置工具箱，支持两种运行模式：

1. 初始化模式（默认）
   命令：python3 manage_built_in_agent_and_tool.py
   功能说明：
   - 首次部署时：执行初始化操作，只添加不存在的内置工具箱
   - 已有工具箱时：保持现有配置不变，不执行更新

2. 更新模式
   命令：python3 manage_built_in_agent_and_tool.py --update
   功能说明：
   - 首次部署时：与初始化模式行为一致
   - 已有工具箱时：更新工具箱配置
   更新范围：
   - 更新内容：工具箱配置
"""
import argparse
import os
import sys
import time

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from data_migrations.init.tools.built_in_tools import manage_built_in_tools



# 解析命令行参数（仅当以 `python .../manage_built_in_agent_and_tool.py` 运行时解析；
# 被 main / uvicorn 导入时不能解析全局 sys.argv，否则会与 uvicorn CLI 冲突。）
def parse_args():
    parser = argparse.ArgumentParser(description="管理内置agent和工具")
    parser.add_argument(
        "-u", "--update", action="store_true", help="启用更新模式，默认不更新"
    )
    return parser.parse_args()


# 现在的处理逻辑：
# 1.服务启动时先进行内置工具箱处理，处理成功再启动http server
# 2.如果失败会进行重试（重试时间间隔：1、3、5、10、20）
# 3.如果都重试失败，退出程序
def init_built_in_agent_and_tool(update: bool = False):
    """执行管理任务，并在失败时按照退避策略重试"""
    retry_intervals = [1, 3, 5, 10, 20]  # 秒
    for idx, interval in enumerate[int](retry_intervals):
        try:
            print(
                f"运行模式: {'更新' if update else '初始化'}（第 {idx + 1} 次尝试）"
            )
            # 1. 插入内置工具
            manage_built_in_tools(update)

            print("操作完成！")
            return
        except Exception as e:
            import logging
            logging.error("管理内置工具箱失败", exc_info=e)

            if idx < len(retry_intervals) - 1:
                print(f"{interval} 秒后重试...（已重试 {idx + 1} 次）")
                time.sleep(interval)
            else:
                print("已重试 5 次仍然失败，程序退出。")
                sys.exit(1)


if __name__ == "__main__":
    _cli_args = parse_args()
    init_built_in_agent_and_tool(update=_cli_args.update)
