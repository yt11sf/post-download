# Post Download
This is a Firefox extension that send request to local Python server for system shutdown/restart/sleep after all download events were completed. The extension will also restart failed download for a given number of times.

## To install:
1. Make sure Python 3.7+ is installed.
2. Open terminal and enter `pip install -r requirements.txt` to install required packages.
3. Run `python shutdown.py`
4. Open `about:debugging#/runtime/this-firefox` in Firefox.
5. Click `Load Temporary Add-on` and open `manifest.json`.


## TODO:
- Chrome compability.
- Run Python script from client.
- System privileges for future exe/bash etc.
- Popup size of firefox not in full screen

## Notes
This extension is for personal use only.
The python server is limited by system admin priviledges.

Referenced from: https://github.com/ion201/gnome-download-notify