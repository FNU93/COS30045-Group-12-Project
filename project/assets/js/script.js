// Toggle Drawer Navigation
document.getElementById('drawer-button').addEventListener('click', function () {
    const drawer = document.getElementById('drawer');
    if (drawer.style.right === '0px') {
        drawer.style.right = `-${drawer.offsetWidth}px`;
    } else {
        drawer.style.right = '0px';
    }
});

document.addEventListener('click', function (event) {
    const drawer = document.getElementById('drawer');
    const drawerButton = document.getElementById('drawer-button');
    if (!drawer.contains(event.target) && !drawerButton.contains(event.target)) {
        if (drawer.style.right === '0px') {
            drawer.style.right = `-${drawer.offsetWidth}px`;
        }
    }
});
