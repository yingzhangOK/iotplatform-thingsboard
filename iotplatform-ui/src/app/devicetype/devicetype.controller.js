/*
 * Copyright © 2016-2017 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable import/no-unresolved, import/default */

import addDeviceTypeTemplate from './add-devicetype.tpl.html';
import deviceCard from './devicetype-card.tpl.html';
import assignToCustomerTemplate from './assign-to-customer.tpl.html';
import addDevicesToCustomerTemplate from './add-to-customer.tpl.html';

/* eslint-enable import/no-unresolved, import/default */

/*@ngInject*/
export function DeviceTypeCardController(types) {

    var vm = this;

    vm.types = types;

    vm.isAssignedToCustomer = function() {
        if (vm.item && vm.item.customerId && vm.parentCtl.devicesScope === 'tenant' &&
            vm.item.customerId.id != vm.types.id.nullUid && !vm.item.assignedCustomer.isPublic) {
            return true;
        }
        return false;
    }

    vm.isPublic = function() {
        if (vm.item && vm.item.assignedCustomer && vm.parentCtl.devicesScope === 'tenant' && vm.item.assignedCustomer.isPublic) {
            return true;
        }
        return false;
    }
}


/*@ngInject*/
export function DeviceTypeController($rootScope, userService, deviceTypeService, customerService, $state, $stateParams,
                                 $document, $mdDialog, $q, $translate, types) {

    var customerId = $stateParams.customerId;

    var deviceActionsList = [];

    var deviceGroupActionsList = [];

    var vm = this;

    vm.types = types;

    vm.devicetypeGridConfig = {
        deleteItemTitleFunc: deleteDeviceTitle,
        deleteItemContentFunc: deleteDeviceText,
        deleteItemsTitleFunc: deleteDevicesTitle,
        deleteItemsActionTitleFunc: deleteDevicesActionTitle,
        deleteItemsContentFunc: deleteDevicesText,

        saveItemFunc: saveDevice,

        getItemTitleFunc: getDeviceTitle,

        itemCardController: 'DeviceTypeCardController',
        itemCardTemplateUrl: deviceCard,
        parentCtl: vm,

        actionsList: deviceActionsList,
        groupActionsList: deviceGroupActionsList,

        onGridInited: gridInited,

        addItemTemplateUrl: addDeviceTypeTemplate,

        addItemText: function() { return $translate.instant('devicetype.add-devicetype-text') },
        noItemsText: function() { return $translate.instant('devicetype.no-devicetypes-text') },
        itemDetailsText: function() { return $translate.instant('devicetype.devicetype-details') },
        isDetailsReadOnly: isCustomerUser,
        isSelectionEnabled: function () {
            return !isCustomerUser();
        }
    };

    if (angular.isDefined($stateParams.items) && $stateParams.items !== null) {
        vm.devicetypeGridConfig.items = $stateParams.items;
    }

    if (angular.isDefined($stateParams.topIndex) && $stateParams.topIndex > 0) {
        vm.devicetypeGridConfig.topIndex = $stateParams.topIndex;
    }

    vm.devicestypeScope = $state.$current.data.devicesType;

    vm.assignToCustomer = assignToCustomer;
    vm.makePublic = makePublic;
    vm.unassignFromCustomer = unassignFromCustomer;

    initController();

    function initController() {
        var fetchDevicesFunction = null;
        var deleteDeviceFunction = null;
        var refreshDevicesParamsFunction = null;

        var user = userService.getCurrentUser();

        if (user.authority === 'CUSTOMER_USER') {
            vm.devicesScope = 'customer_user';
            customerId = user.customerId;
        }
        if (customerId) {
            vm.customerDevicesTitle = $translate.instant('customer.devices');
            customerService.getShortCustomerInfo(customerId).then(
                function success(info) {
                    if (info.isPublic) {
                        vm.customerDevicesTitle = $translate.instant('customer.public-devices');
                    }
                }
            );
        }

        if (vm.devicestypeScope === 'tenant') {
            fetchDevicesFunction = function (pageLink, deviceType) {
                return deviceTypeService.getTenantDevices(pageLink, true, null, deviceType);
            };
            deleteDeviceFunction = function (deviceId) {
                return deviceTypeService.deleteDevice(deviceId);
            };
            refreshDevicesParamsFunction = function() {
                return {"topIndex": vm.topIndex};
            };

            deviceActionsList.push({
                onAction: function ($event, item) {
                    makePublic($event, item);
                },
                name: function() { return $translate.instant('action.share') },
                details: function() { return $translate.instant('devicetype.make-public') },
                icon: "share",
                isEnabled: function(device) {
                    return device && (!device.customerId || device.customerId.id === types.id.nullUid);
                }
            });

            deviceActionsList.push(
                {
                    onAction: function ($event, item) {
                        assignToCustomer($event, [ item.id.id ]);
                    },
                    name: function() { return $translate.instant('action.assign') },
                    details: function() { return $translate.instant('devicetype.assign-to-customer') },
                    icon: "assignment_ind",
                    isEnabled: function(device) {
                        return device && (!device.customerId || device.customerId.id === types.id.nullUid);
                    }
                }
            );

            deviceActionsList.push(
                {
                    onAction: function ($event, item) {
                        unassignFromCustomer($event, item, false);
                    },
                    name: function() { return $translate.instant('action.unassign') },
                    details: function() { return $translate.instant('devicetype.unassign-from-customer') },
                    icon: "assignment_return",
                    isEnabled: function(device) {
                        return device && device.customerId && device.customerId.id !== types.id.nullUid && !device.assignedCustomer.isPublic;
                    }
                }
            );

            deviceActionsList.push({
                onAction: function ($event, item) {
                    unassignFromCustomer($event, item, true);
                },
                name: function() { return $translate.instant('action.make-private') },
                details: function() { return $translate.instant('devicetype.make-private') },
                icon: "reply",
                isEnabled: function(device) {
                    return device && device.customerId && device.customerId.id !== types.id.nullUid && device.assignedCustomer.isPublic;
                }
            });

         

            deviceActionsList.push(
                {
                    onAction: function ($event, item) {
                        vm.grid.deleteItem($event, item);
                    },
                    name: function() { return $translate.instant('action.delete') },
                    details: function() { return $translate.instant('devicetype.delete') },
                    icon: "delete"
                }
            );

            deviceGroupActionsList.push(
                {
                    onAction: function ($event, items) {
                        assignDevicesToCustomer($event, items);
                    },
                    name: function() { return $translate.instant('devicetype.assign-devices') },
                    details: function(selectedCount) {
                        return $translate.instant('devicetype.assign-devices-text', {count: selectedCount}, "messageformat");
                    },
                    icon: "assignment_ind"
                }
            );

            deviceGroupActionsList.push(
                {
                    onAction: function ($event) {
                        vm.grid.deleteItems($event);
                    },
                    name: function() { return $translate.instant('devicetype.delete-devices') },
                    details: deleteDevicesActionTitle,
                    icon: "delete"
                }
            );



        } else if (vm.devicestypeScope === 'customer' || vm.devicestypeScope === 'customer_user') {
            fetchDevicesFunction = function (pageLink, deviceType) {
                return deviceTypeService.getCustomerDevices(customerId, pageLink, true, null, deviceType);
            };
            deleteDeviceFunction = function (deviceId) {
                return deviceTypeService.unassignDeviceFromCustomer(deviceId);
            };
            refreshDevicesParamsFunction = function () {
                return {"customerId": customerId, "topIndex": vm.topIndex};
            };

            if (vm.devicestypeScope === 'customer') {
                deviceActionsList.push(
                    {
                        onAction: function ($event, item) {
                            unassignFromCustomer($event, item, false);
                        },
                        name: function() { return $translate.instant('action.unassign') },
                        details: function() { return $translate.instant('devicetype.unassign-from-customer') },
                        icon: "assignment_return",
                        isEnabled: function(device) {
                            return device && !device.assignedCustomer.isPublic;
                        }
                    }
                );
                deviceActionsList.push(
                    {
                        onAction: function ($event, item) {
                            unassignFromCustomer($event, item, true);
                        },
                        name: function() { return $translate.instant('action.make-private') },
                        details: function() { return $translate.instant('devicetype.make-private') },
                        icon: "reply",
                        isEnabled: function(device) {
                            return device && device.assignedCustomer.isPublic;
                        }
                    }
                );

               
                deviceGroupActionsList.push(
                    {
                        onAction: function ($event, items) {
                            unassignDevicesFromCustomer($event, items);
                        },
                        name: function() { return $translate.instant('devicetype.unassign-devices') },
                        details: function(selectedCount) {
                            return $translate.instant('devicetype.unassign-devices-action-title', {count: selectedCount}, "messageformat");
                        },
                        icon: "assignment_return"
                    }
                );

                vm.devicetypeGridConfig.addItemAction = {
                    onAction: function ($event) {
                        addDevicesToCustomer($event);
                    },
                    name: function() { return $translate.instant('devicetype.assign-devices') },
                    details: function() { return $translate.instant('devicetype.assign-new-device') },
                    icon: "add"
                };


            } else if (vm.devicestypeScope === 'customer_user') {
               

                vm.devicetypeGridConfig.addItemAction = {};
            }
        }

        vm.devicetypeGridConfig.refreshParamsFunc = refreshDevicesParamsFunction;
        vm.devicetypeGridConfig.fetchItemsFunc = fetchDevicesFunction;
        vm.devicetypeGridConfig.deleteItemFunc = deleteDeviceFunction;

    }

    function deleteDeviceTitle(device) {
        return $translate.instant('devicetype.delete-device-title', {deviceName: device.name});
    }

    function deleteDeviceText() {
        return $translate.instant('devicetype.delete-device-text');
    }

    function deleteDevicesTitle(selectedCount) {
        return $translate.instant('devicetype.delete-devices-title', {count: selectedCount}, 'messageformat');
    }

    function deleteDevicesActionTitle(selectedCount) {
        return $translate.instant('devicetype.delete-devices-action-title', {count: selectedCount}, 'messageformat');
    }

    function deleteDevicesText () {
        return $translate.instant('devicetype.delete-devices-text');
    }

    function gridInited(grid) {
        vm.grid = grid;
    }

    function getDeviceTitle(device) {
        return device ? device.name : '';
    }

    function saveDevice(device) {
        var deferred = $q.defer();
        deviceTypeService.saveDevice(device).then(
            function success(savedDevice) {
                $rootScope.$broadcast('devicetypeSaved');
                var devices = [ savedDevice ];
                customerService.applyAssignedCustomersInfo(devices).then(
                    function success(items) {
                        if (items && items.length == 1) {
                            deferred.resolve(items[0]);
                        } else {
                            deferred.reject();
                        }
                    },
                    function fail() {
                        deferred.reject();
                    }
                );
            },
            function fail() {
                deferred.reject();
            }
        );
        return deferred.promise;
    }

    function isCustomerUser() {
        return vm.devicesScope === 'customer_user';
    }

    function assignToCustomer($event, deviceIds) {
        if ($event) {
            $event.stopPropagation();
        }
        var pageSize = 10;
        customerService.getCustomers({limit: pageSize, textSearch: ''}).then(
            function success(_customers) {
                var customers = {
                    pageSize: pageSize,
                    data: _customers.data,
                    nextPageLink: _customers.nextPageLink,
                    selection: null,
                    hasNext: _customers.hasNext,
                    pending: false
                };
                if (customers.hasNext) {
                    customers.nextPageLink.limit = pageSize;
                }
                $mdDialog.show({
                    controller: 'AssignDeviceToCustomerController',
                    controllerAs: 'vm',
                    templateUrl: assignToCustomerTemplate,
                    locals: {deviceIds: deviceIds, customers: customers},
                    parent: angular.element($document[0].body),
                    fullscreen: true,
                    targetEvent: $event
                }).then(function () {
                    vm.grid.refreshList();
                }, function () {
                });
            },
            function fail() {
            });
    }

    function addDevicesToCustomer($event) {
        if ($event) {
            $event.stopPropagation();
        }
        var pageSize = 10;
        deviceTypeService.getTenantDevices({limit: pageSize, textSearch: ''}, false).then(
            function success(_devices) {
                var devices = {
                    pageSize: pageSize,
                    data: _devices.data,
                    nextPageLink: _devices.nextPageLink,
                    selections: {},
                    selectedCount: 0,
                    hasNext: _devices.hasNext,
                    pending: false
                };
                if (devices.hasNext) {
                    devices.nextPageLink.limit = pageSize;
                }
                $mdDialog.show({
                    controller: 'AddDevicesToCustomerController',
                    controllerAs: 'vm',
                    templateUrl: addDevicesToCustomerTemplate,
                    locals: {customerId: customerId, devices: devices},
                    parent: angular.element($document[0].body),
                    fullscreen: true,
                    targetEvent: $event
                }).then(function () {
                    vm.grid.refreshList();
                }, function () {
                });
            },
            function fail() {
            });
    }

    function assignDevicesToCustomer($event, items) {
        var deviceIds = [];
        for (var id in items.selections) {
            deviceIds.push(id);
        }
        assignToCustomer($event, deviceIds);
    }

    function unassignFromCustomer($event, device, isPublic) {
        if ($event) {
            $event.stopPropagation();
        }
        var title;
        var content;
        var label;
        if (isPublic) {
            title = $translate.instant('devicetype.make-private-device-title', {deviceName: device.name});
            content = $translate.instant('devicetype.make-private-device-text');
            label = $translate.instant('devicetype.make-private');
        } else {
            title = $translate.instant('devicetype.unassign-device-title', {deviceName: device.name});
            content = $translate.instant('devicetype.unassign-device-text');
            label = $translate.instant('devicetype.unassign-device');
        }
        var confirm = $mdDialog.confirm()
            .targetEvent($event)
            .title(title)
            .htmlContent(content)
            .ariaLabel(label)
            .cancel($translate.instant('action.no'))
            .ok($translate.instant('action.yes'));
        $mdDialog.show(confirm).then(function () {
            deviceTypeService.unassignDeviceFromCustomer(device.id.id).then(function success() {
                vm.grid.refreshList();
            });
        });
    }

    function unassignDevicesFromCustomer($event, items) {
        var confirm = $mdDialog.confirm()
            .targetEvent($event)
            .title($translate.instant('devicetype.unassign-devices-title', {count: items.selectedCount}, 'messageformat'))
            .htmlContent($translate.instant('devicetype.unassign-devices-text'))
            .ariaLabel($translate.instant('devicetype.unassign-device'))
            .cancel($translate.instant('action.no'))
            .ok($translate.instant('action.yes'));
        $mdDialog.show(confirm).then(function () {
            var tasks = [];
            for (var id in items.selections) {
                tasks.push(deviceTypeService.unassignDeviceFromCustomer(id));
            }
            $q.all(tasks).then(function () {
                vm.grid.refreshList();
            });
        });
    }

    function makePublic($event, device) {
        if ($event) {
            $event.stopPropagation();
        }
        var confirm = $mdDialog.confirm()
            .targetEvent($event)
            .title($translate.instant('devicetype.make-public-device-title', {deviceName: device.name}))
            .htmlContent($translate.instant('devicetype.make-public-device-text'))
            .ariaLabel($translate.instant('devicetype.make-public'))
            .cancel($translate.instant('action.no'))
            .ok($translate.instant('action.yes'));
        $mdDialog.show(confirm).then(function () {
            deviceTypeService.makeDevicePublic(device.id.id).then(function success() {
                vm.grid.refreshList();
            });
        });
    }

   
}
