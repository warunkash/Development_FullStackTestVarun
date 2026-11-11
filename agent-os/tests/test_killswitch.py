import pytest

from agent_os import KillSwitch, Killed


def test_in_process_trip():
    k = KillSwitch()
    assert k.tripped is False
    k.check()
    k.trip("operator said stop")
    assert k.tripped is True
    with pytest.raises(Killed, match="operator said stop"):
        k.check()


def test_file_trip_works_without_a_handle(tmp_path):
    # The 3am case: another process, or a person with a shell, stops the agent.
    path = tmp_path / "agent.stop"
    k = KillSwitch(path)
    k.check()
    path.touch()
    with pytest.raises(Killed, match="kill file present"):
        k.check()


def test_reset_rearms_and_removes_the_file(tmp_path):
    path = tmp_path / "agent.stop"
    k = KillSwitch(path)
    path.touch()
    assert k.tripped is True
    k.reset()
    assert k.tripped is False
    assert not path.exists()


def test_reset_clears_in_process_flag():
    k = KillSwitch()
    k.trip()
    k.reset()
    k.check()
