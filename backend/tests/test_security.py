from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("incorrect horse battery staple", password_hash)


def test_access_token_round_trip() -> None:
    token = create_access_token(subject="user-1", session_id="session-1")
    payload = decode_access_token(token)

    assert payload["sub"] == "user-1"
    assert payload["sid"] == "session-1"
