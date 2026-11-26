Stagehand {{VERSION}}: hosting package
======================================
A web controller for OBS Studio.

This folder lets you host Stagehand on a Windows PC (normally the OBS PC), so anyone on
the local network can use it by opening a web address. Nothing is installed on their computers.

Full documentation: https://github.com/julesrodrigues11/stagehand-obs


FIRST-TIME SETUP (on the PC that will host it)
----------------------------------------------
1. Install Node.js (LTS) from https://nodejs.org if it isn't installed already.
   Check with:  node -v   in a Command Prompt.
2. Before extracting the zip: right-click it > Properties > tick "Unblock" > OK. (Windows flags
   downloaded files; unblocking avoids security prompts when running the .bat files.)
   Then put the "stagehand-obs" folder somewhere permanent, e.g. C:\Stagehand\
3. Right-click add-firewall-rule.bat > "Run as administrator".
   This allows other PCs to reach the app (port 8080) and OBS's WebSocket server (port 4455).
4. In OBS: Tools > WebSocket Server Settings > enable the server and set a password.
5. Double-click start.bat. The window shows the address(es) to use, e.g.
       From other PCs:    http://192.168.1.50:8080
   Keep the window open (minimise it) while the app is in use.

Optional: double-click install-autostart.bat so it starts (minimised) every time you log in.
remove-autostart.bat undoes that.


USING IT
--------
Open the address shown by start.bat in a browser on any PC on the network.
When the app is hosted on the OBS PC, "+ New" connections already point at that PC:
just enter the OBS WebSocket password.


SETTINGS: host-config.json
--------------------------
  "port"     The port the app is served on (default 8080). If you change it, run
             add-firewall-rule.bat again with the new port:  add-firewall-rule.bat 9000
  "obsHost"  Where OBS is, used as the default address for new connections:
               "same"           OBS runs on this PC (default)
               "192.168.1.50"   OBS runs on another PC (its address)
               null             don't suggest an address
  "obsPort"  OBS WebSocket port (default 4455)
Restart start.bat after changing settings.


UPDATING
--------
1. Close the start.bat window.
2. Download the new zip from the GitHub "Releases" page.
3. Replace this folder's contents with the new ones. Keep your host-config.json if you changed it.
4. Start it again. Users just reload the page.
Saved connections are kept: they're stored in each user's browser, not in this folder.
(Keep the same address and port: browsers keep a separate list for each address.)

Updating from OBS Web Controller (the app's old name, v0.2 or earlier): the folder is now
called "stagehand-obs". After replacing it, run install-autostart.bat again if you use it,
and add-firewall-rule.bat as administrator. Both remove the old-named shortcut and rules.


TROUBLESHOOTING
---------------
- "Node.js isn't installed": install it (step 1), then close and reopen the window.
- "Port 8080 is already in use": it's probably already running (check the taskbar), or another
  program uses that port: choose another port in host-config.json.
- Other PCs can't open the address: run add-firewall-rule.bat as administrator, and make sure
  Windows treats this network as "Private" (Settings > Network & internet).
