from typing import Annotated

from fastapi import Depends
from starlette.requests import HTTPConnection

from .runtime import Runtime


def get_runtime(connection: HTTPConnection) -> Runtime:
    runtime: object = connection.app.state.runtime
    if not isinstance(runtime, Runtime):
        raise RuntimeError("Application runtime is not initialized")
    return runtime


RuntimeDependency = Annotated[Runtime, Depends(get_runtime)]
