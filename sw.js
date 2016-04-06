'use strict';
importScripts('/bower_components/sw-toolbox/sw-toolbox.js'); //

const ORIGIN_RULE = /(gameofbros\.co\.uk|localhost)/;
const DEFAULT_TAG = "gameofbros";
const DEFAULT_ACTIONS = [];
const URL_TO_DEFAULT_ICON = "/images/icons/notificaion-icon.png";
const URL_TO_NOTIFICATIONS = "https://www.validatethis.co.uk/playground/push/read-notification.php?registration_id=";
const OWN_DOMAINS = ["gameofbros.co.uk",
                       "www.gameofbros.co.uk",
                       "localhost:9000"];

// Turn on debug logging, visible in the Developer Tools' console.
toolbox.options.debug = true;
toolbox.options.cache.name = 'Game of Bros';

// Which files will definitly be needed for offline viewing
/*toolbox.precache([
    '/Offline',
    '/Offline/Json'
]);*/

// No not cache the following files - always server from network
toolbox.router.get('/sw.js', toolbox.networkOnly, { origin: ORIGIN_RULE });
//toolbox.router.get('/misc/manifest.json', toolbox.networkOnly, { origin: ORIGIN_RULE });
toolbox.router.get('/robots.txt', toolbox.networkOnly, { origin: ORIGIN_RULE });
toolbox.router.get('/ajax/updateheader*', toolbox.networkOnly, { origin: ORIGIN_RULE });
toolbox.router.get('/ajax/quickbuydropdown*', toolbox.networkOnly, { origin: ORIGIN_RULE });

// Network only for Account and Checkout
toolbox.router.get('/account*', toolbox.networkOnly, { origin: ORIGIN_RULE });
toolbox.router.get('/checkout*', toolbox.networkOnly, { origin: ORIGIN_RULE });

// Cache first for things with a GUID
toolbox.router.get('/images*', toolbox.fastest, { origin: ORIGIN_RULE });
toolbox.router.get('/bundles*', toolbox.fastest, { origin: ORIGIN_RULE });
toolbox.router.get('/*fonts*', toolbox.fastest, { origin: ORIGIN_RULE }); // Font files don't change ofter, if at all
toolbox.router.get('/*bower_components*', toolbox.fastest, { origin: ORIGIN_RULE }); // bower_components are libraries, they should not be modified - in the event of an update a CTRL+F5 will update it


// Default cache rule
toolbox.router.get('/(.*)', function (request, values, options) {
    // networkFirst will attempt to return a response from the network,
    // then attempt to return a response from the cache.
    return toolbox.networkFirst(request, values, options).catch(function (error) {
        // If both the network and the cache fail, then `.catch()` will be triggered,
        // and we get a chance to respond with our cached fallback page.
        // This would ideally check event.request.mode === 'navigate', but that isn't supported in
        // Chrome as of M48. See https://fetch.spec.whatwg.org/#concept-request-mode
        if (request.method === 'GET' && request.headers.get('accept').includes('text/html')) {
            return toolbox.cacheOnly(new Request('/Offline'), values, options);
        }

        if (request.method === 'GET' && request.headers.get('accept').includes('application/json')) {
            return toolbox.cacheOnly(new Request('/Offline/Json'), values, options);
        }
        throw error;
    });
}, {
    origin: ORIGIN_RULE
});





self.addEventListener('install', function (event) {
    self.skipWaiting();
    console.log("Latest version");
});

self.addEventListener('push', function (event) {

    // Since there is no payload data with the first version
    // of push messages, we'll grab some data from
    // an API and use it to populate a notification
    event.waitUntil(self.registration.pushManager.getSubscription().then(function (pushSubscription) {

        var endURL = URL_TO_NOTIFICATIONS + pushSubscription.endpoint;

        return fetch(endURL).then(function (response) {
            if (response.status !== 200) {
                // Either show a message to the user explaining the error
                // or enter a generic message and handle the
                // onnotificationclick event to direct the user to a web page
                console.log('Looks like there was a problem. Status Code: ' + response.status);
                throw new Error();
            }

            // Examine the text in the response
            return response.json().then(function (data) {
                if (data.error || !data.notification) {
                    console.error('The API returned an error.', data.error);
                    throw new Error();
                }

                var title = data.notification.title;
                var body = data.notification.body;
                var icon = data.notification.icon == "" ? URL_TO_DEFAULT_ICON : data.notification.icon;
                var actions = data.notification.actions == "" ? DEFAULT_ACTIONS : data.notification.actions;
                var notificationTag = data.notification.tag == "" ? DEFAULT_TAG : data.notification.tag;

                var payload = {
                    body: body,
                    icon: icon,
                    tag: notificationTag,
                    actions: actions
                };

                if (data.notification.data) {
                    payload.data = data.notification.data;
                }

                return self.registration.showNotification(title, payload);
            });
        }).catch(function (err) {
            console.error('Unable to retrieve data', err);

            var title = 'Game of Bros';
            var body = 'Visit now to see whats new!';
            var icon = URL_TO_DEFAULT_ICON;
            var notificationTag = 'notification-error';

            return self.registration.showNotification(title, {
                body: body,
                icon: icon,
                tag: notificationTag
            });
        })
    })
    );

});

self.addEventListener('notificationclick', function (event) {
    console.log('On notification click: ', event.notification.tag);
    // Android doesn't close the notification when you click on it
    // See: http://crbug.com/463146
    event.notification.close();

    // Get the URL we would like to load
    var endUrl = '/';

    if (event.notification.data != null) {
        endUrl = event.notification.data.url;
    }
    var tracking = "?utm_source=push_notification&utm_medium=push_notification&utm_campaign=" + event.notification.tag;

    if (event.action === 'archive') {
        //silentlyArchiveNotification();
    } else {

        // This looks to see if the current is already open and
        // focuses if it is
        event.waitUntil(
          clients.matchAll({
              type: "window"
          })
          .then(function (clientList) {
              for (var i = 0; i < clientList.length; i++) {
                  var client = clientList[i];

                  for (var y = 0; y < OWN_DOMAINS.length; y++) {
                      if (client.url.indexOf(OWN_DOMAINS[y] !== -1))
                          return client.focus();
                  }

                  if ((client.url == endUrl) && 'focus' in client)
                      return client.focus();
              }
              if (clients.openWindow) {
                  return clients.openWindow(endUrl + tracking);
              }
          })
        );

    }

});
