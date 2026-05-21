# -*- coding: utf-8 -*-
from fastapi import Request, status, Body
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app import create_app
from app.utils.exception import UnicornException, NewErrorBase, ErrVal, RequestException
from config import settings
from data_migrations.init.manage_built_in_agent_and_tool import init_built_in_agent_and_tool

app = create_app()


@app.exception_handler(UnicornException)
async def unicorn_exception_handler(request: Request, exc: UnicornException):
    return JSONResponse(
        status_code=500,
        content={"Description": exc.name,
                 "ErrorCode": "MF.BeforeRequest.ParametersError",
                 "ErrorDetails": "{}".format(exc.name),
                 "ErrorLink": "",
                 "Solution": "method is not validate"}
    )


@app.exception_handler(RequestException)
async def request_exception_handler(request: Request, exc: UnicornException):
    return JSONResponse(
        status_code=400,
        content={"Description": exc.name,
                 "ErrorCode": "MF.BeforeRequest.ParametersError",
                 "ErrorDetails": "{}".format(exc.name),
                 "ErrorLink": "",
                 "Solution": "method is not validate"}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request,
                                       exc: RequestValidationError):
    err = NewErrorBase(status.HTTP_400_BAD_REQUEST, ErrVal.Err_Args_Err,
                       exc.errors()[0])
    return JSONResponse(
        status_code=err.statu_code,
        content=jsonable_encoder(err.err_model.dict()),
    )


# 初始化内置工具箱, 如果失败会进行重试（DEBUG_MODE 为 True 时跳过）
if not settings.DEBUG_MODE:
    init_built_in_agent_and_tool()

if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host=settings.SERVER_HOST, port=settings.SERVER_PORT)
