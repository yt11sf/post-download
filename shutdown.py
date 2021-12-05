from ctypes import windll
from flask import Flask, abort, request
from flask_cors import CORS
from os import name, system
from time import localtime, sleep, time
from threading import Thread
import win32security
import win32api

KEEP_ALIVE_INV_MS = 15

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'


@app.route('/req=<req>')
def shutdown(req):
    # print(req)
    req, buffer = req.split('&')
    if req == 'notif':   # Message
        print(f'\033[96m{buffer}\033[0m')
        return '', 204
    if name == 'nt':  # Windows OS
        if req == 'shutdown':
            system('shutdown /s /t ' + buffer)
            print(f'\033[96mShutting down in {buffer} seconds\033[0m')
            return 'Shutting down in ' + buffer + ' seconds', 200
        elif req == 'restart':
            system('shutdown /r /t ' + buffer)
            print(f'\033[96mRestarting down in {buffer} seconds\033[0m')
            return 'Restarting in ' + buffer + ' seconds', 200
        elif req == 'suspend':
            Thread(target=suspend, args=(buffer,)).start()
            print(f'\033[96mSuspending in {buffer} seconds\033[0m')
            return 'Suspending in ' + buffer + ' seconds', 200
        elif req == 'abort':
            system('shutdown /a')
            print(f'\033[96mShutdown aborted\033[0m')
            return 'Shutdown aborted', 200
        else:
            abort(500)
    elif name == 'posix':  # Unix based OS (For Debian)
        bufferMin = str(int(buffer)/60)
        if req == 'shutdown':
            system('sudo shutdown -h ' + bufferMin +
                   ' \'Shutting down in ' + bufferMin + ' minutes\'')
            return 'Shutting down in ' + buffer + ' seconds', 200
        elif req == 'restart':
            system('sudo shutdown - r ' + bufferMin +
                   ' \'Restarting in ' + bufferMin + ' minutes\'')
            return 'Restarting in ' + buffer + ' seconds', 200
        elif req == 'suspend':
            print('Suspending in ' + bufferMin + ' minutes')
            sleep(float(buffer))
            system('systemctl suspend')
            return 'Suspending in ' + buffer + ' seconds', 200
        elif req == 'abort':
            system('shutdown -c')
            print('Shutdown aborted')
            return 'Shutdown aborted', 200
        else:
            abort(400)
    else:
        print('OS not supported')
        return 'OS not supported', 503


def suspend(buffer, hibernate=False):
    '''Puts Windows to Suspend/Sleep/Standby or Hibernate.

    Reference from: https://stackoverflow.com/a/39360397 (Ronan Paixão)

    Parameters
    ----------
    hibernate: bool, default False
        If False (default), system will enter Suspend/Sleep/Standby state.
        If True, system will Hibernate, but only if Hibernate is enabled in the
        system settings. If it's not, system will Sleep.

    Example:
    --------
    >>> suspend()
    '''
    print('before sleep')
    sleep(float(buffer))
    print('after sleep')
    # Enable the SeShutdown privilege (which must be present in your
    # token in the first place)
    priv_flags = (win32security.TOKEN_ADJUST_PRIVILEGES |
                  win32security.TOKEN_QUERY)
    hToken = win32security.OpenProcessToken(
        win32api.GetCurrentProcess(),
        priv_flags
    )
    priv_id = win32security.LookupPrivilegeValue(
        None,
        win32security.SE_SHUTDOWN_NAME
    )
    old_privs = win32security.AdjustTokenPrivileges(
        hToken,
        0,
        [(priv_id, win32security.SE_PRIVILEGE_ENABLED)]
    )

    if (win32api.GetPwrCapabilities()['HiberFilePresent'] == False and
            hibernate == True):
        import warnings
        warnings.warn("Hibernate isn't available. Suspending.")
    try:
        windll.powrprof.SetSuspendState(not hibernate, True, False)
    except:
        # True=> Standby; False=> Hibernate
        # https://msdn.microsoft.com/pt-br/library/windows/desktop/aa373206(v=vs.85).aspx
        # says the second parameter has no effect.
        #        ctypes.windll.kernel32.SetSystemPowerState(not hibernate, True)
        win32api.SetSystemPowerState(not hibernate, True)

    # Restore previous privileges
    win32security.AdjustTokenPrivileges(
        hToken,
        0,
        old_privs
    )


@app.route('/log', methods=['POST'])
def logging():
    t = localtime(time())
    date = f'{t.tm_year}-{str(t.tm_mon).rjust(2,"0")}-{str(t.tm_mday).rjust(2,"0")}'
    with open(f'log_{date}.txt', 'a') as f:
        f.write(
            f'{date}-{str(t.tm_hour).rjust(2,"0")}:{str(t.tm_min).rjust(2,"0")}:{str(t.tm_sec).rjust(2,"0")}\t{request.json}\n')
    return '', 204


"""
@app.route('/alive')
def alive():
    print(active_count())
    print(enumerate())
    if active_count() < 2:
        global old_t
        old_t = 0
        Thread(target=keep_alive).start()
    old_t = time()
    return '', 204


def keep_alive(timeout=KEEP_ALIVE_INV_MS):
    global old_t
    while True:
        print(time() - old_t, flush=True)
        if time() - old_t > timeout:
            break
        else:
            sleep(timeout)
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
"""

if __name__ == '__main__':
    app.run()
