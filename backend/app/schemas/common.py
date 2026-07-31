from pydantic import BaseModel


class MessageRead(BaseModel):
    message: str
