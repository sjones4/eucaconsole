/**
 * Copyright 2017 Ent. Services Development Corporation LP
 *
 * @fileOverview Launch Config Wizard JS
 * @requires AngularJS
 *
 */

// Launch Config Wizard includes the Image Picker, BDM editor, and security group rules editor
angular.module('LaunchConfigWizard', ['ImagePicker', 'BlockDeviceMappingEditor', 'SecurityGroupRules', 'EucaConsoleUtils'])
    .controller('LaunchConfigWizardCtrl', function ($scope, $http, $timeout, eucaHandleError, eucaUnescapeJson) {
        $scope.launchForm = $('#launch-config-form');
        $scope.imageID = '';
        $scope.imageName = '';
        $scope.imagePlatform = '';
        $scope.imageRootDeviceType = '';
        $scope.imageLocation = '';
        $scope.urlParams = $.url().param();
        $scope.summarySection = $('.summary');
        $scope.launchconfigName = '';
        $scope.instanceTypeSelected = '';
        $scope.securityGroups = [];
        $scope.securityGroupJsonEndpoint = '';
        $scope.securityGroupsRulesJsonEndpoint = '';
        $scope.securityGroupCollection = {};
        $scope.securityGroupsRules = {};
        $scope.keyPairChoices = {};
        $scope.keyPair = '';
        $scope.newKeyPairName = '';
        $scope.keyPairSelected = '';
        $scope.keyPairModal = $('#create-keypair-modal');
        $scope.isLoadingKeyPair = false;
        $scope.selectedGroupRules = {};
        $scope.securityGroupModal = $('#create-securitygroup-modal');
        $scope.securityGroupForm = $('#create-securitygroup-form');
        $scope.securityGroupChoices = {};
        $scope.securityGroupChoicesFullName = {};
        $scope.isRuleExpanded = {};
        $scope.newSecurityGroupName = '';
        $scope.securityGroupSelected = '';
        $scope.isLoadingSecurityGroup = false;
        $scope.isCreateSGChecked = true;
        $scope.role = '';
        $scope.roleList = [];
        $scope.currentStepIndex = 1;
        $scope.step1Invalid = true;
        $scope.step2Invalid = true;
        $scope.step3Invalid = true;
        $scope.imageJsonURL = '';
        $scope.isNotValid = true;
        $scope.existsImage = true;
        $scope.imageIDErrorClass = '';
        $scope.imageIDNonexistErrorClass = '';
        $scope.monitoringEnabled = true;
        $scope.initController = function (optionsJson) {
            var options = JSON.parse(eucaUnescapeJson(optionsJson));
            $scope.keyPairChoices = options.keypair_choices;
            $scope.securityGroupChoices = options.securitygroups_choices;
            $scope.roleList = options.role_choices;
            $scope.securityGroupJsonEndpoint = options.securitygroups_json_endpoint;
            $scope.securityGroupsRulesJsonEndpoint = options.securitygroups_rules_json_endpoint;
            $scope.imageJsonURL = options.image_json_endpoint;
            $scope.securityGroupVPC = options.default_vpc_network;
            $scope.getAllSecurityGroups(); 
            $scope.getAllSecurityGroupsRules();
            $scope.setInitialValues();
            $scope.preventFormSubmitOnEnter();
            $scope.initChosenSelectors();
            $scope.setWatcher();
            $scope.setFocus();
        };
        $scope.initChosenSelectors = function () {
            $('#securitygroup').chosen({'width': '100%', search_contains: true});
        };
        $scope.preventFormSubmitOnEnter = function () {
            $(document).ready(function () {
                $('#image-id-input').keydown(function(evt) {
                    if (evt.keyCode === 13) {
                        evt.preventDefault();
                    }
                });
            });
        };
        $scope.getAllSecurityGroups = function () {
            var csrf_token = $('#csrf_token').val();
            var data = "csrf_token=" + csrf_token;
            $http({
                method:'POST', url:$scope.securityGroupJsonEndpoint, data:data,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).success(function(oData) {
                var results = oData ? oData.results : [];
                $scope.securityGroupCollection = results;
            }).error(function (oData) {
                eucaHandleError(oData, status);
            });
        };
        $scope.getAllSecurityGroupsRules = function () {
            var csrf_token = $('#csrf_token').val();
            var data = "csrf_token=" + csrf_token;
            $http({
                method:'POST', url:$scope.securityGroupsRulesJsonEndpoint, data:data,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).success(function(oData) {
                var results = oData ? oData.results : [];
                $scope.securityGroupsRules = results;
                $scope.updateSecurityGroup();
            }).error(function (oData) {
                eucaHandleError(oData, status);
            });
        };
        $scope.updateSecurityGroup = function () {
            if ($scope.securityGroups === undefined) {
                $scope.securityGroups = [];
            }
            angular.forEach($scope.securityGroups, function(securityGroupID) {
                $scope.selectedGroupRules[securityGroupID] = $scope.securityGroupsRules[securityGroupID];
            });
        };
        $scope.updateSecurityGroupChoices = function () {
            $scope.securityGroups = [];
            $scope.securityGroupChoicesFullName = {};
            angular.forEach($scope.securityGroupCollection, function(sGroup){
                var securityGroupName = sGroup.name;
                $scope.securityGroupChoicesFullName[sGroup.id] = securityGroupName;
                if (sGroup.name.length > 30) {
                    securityGroupName = sGroup.name.substr(0, 30) + "...";
                }
                if (sGroup.vpc_id !== null) {
                    securityGroupName = securityGroupName + " (" + sGroup.vpc_id + ")";
                } 
                $scope.securityGroupChoices[sGroup.id] = securityGroupName;
            }); 
            $scope.restoreSecurityGroupsInitialValues(); 
            // Timeout is needed for chosen to react after Angular updates the options
            $timeout(function(){
                $('#securitygroup').trigger('chosen:updated');
            }, 500);
        };
        $scope.setInitialValues = function () {
            $scope.instanceType = 'm1.small';
            $scope.instanceTypeSelected = $scope.urlParams.instance_type || '';
            $scope.instanceNumber = '1';
            $scope.instanceZone = $('#zone').find(':selected').val();
            var lastKeyPair = Modernizr.localstorage && localStorage.getItem('lastkeypair_lc');
            if (lastKeyPair !== null && $scope.keyPairChoices[lastKeyPair] !== undefined) {
                $('#keypair').val(lastKeyPair);
            }
            $scope.keyPair = $('#keypair').find(':selected').val();
            $scope.imageID = $scope.urlParams.image_id || '';
            $scope.keyPairSelected = $scope.urlParams.keypair || '';
            if( $scope.instanceTypeSelected !== '' )
                $scope.instanceType = $scope.instanceTypeSelected;
            if( $scope.keyPairSelected !== '' )
                $scope.keyPair = $scope.keyPairSelected;
            if( $scope.imageID === '' ){
                $scope.currentStepIndex = 1;
            }else{
                $scope.currentStepIndex = 2;
                $scope.step1Invalid = false;
                $scope.loadImageInfo($scope.imageID);
                $timeout(function() {
                    document.getElementById('tabStep2').click();
                    document.getElementById('name').focus();
                });
            }
            $scope.isCreateSGChecked = $('#create_sg_from_lc').is(':checked');
            if ($("#userdata").val().length > 0) {
                $scope.inputtype = "text";
                $scope.userData = $("#userdata").val();
            }
        };
        $scope.restoreSecurityGroupsInitialValues = function () {
            $scope.securityGroupSelected = $scope.urlParams.security_group || '';
            if( $scope.securityGroupSelected === '' ){
                $scope.securityGroupSelected = Modernizr.localstorage && localStorage.getItem('lastsecgroup_lc');
            }
            if ($scope.securityGroupSelected !== '' && $scope.securityGroupSelected !== null) {
                var lastSecGroupArray = $scope.securityGroupSelected.split(",");
                angular.forEach(lastSecGroupArray, function (sgroup) {
                    if ($scope.securityGroupChoices[sgroup] !== undefined) {
                        $scope.securityGroups.push(sgroup);
                    }
                });
            }
        };
        $scope.saveOptions = function() {
            if (Modernizr.localstorage) {
                localStorage.setItem('lastkeypair_lc', $('#keypair').find(':selected').val());
                localStorage.setItem('lastsecgroup_lc', $scope.securityGroups);
            }
        };
        $scope.checkRequiredInput = function () {
            if( $scope.currentStepIndex == 1 ){ 
                if( $scope.isNotValid === false && $scope.imageID.length < 12 ){
                    // Once invalid ID has been entered, do not enable the button unless the ID length is valid
                    // This prevents the error to be triggered as user is typing for the first time 
                    $scope.isNotValid = true;
                    $scope.imageIDErrorClass = "error";
                }else if( $scope.imageID === '' || $scope.imageID === undefined || $scope.imageID.length === 0 ){
                    // Do not enable the button if the input is empty. However, raise no error message
                    $scope.isNotValid = true;
                    $scope.imageIDErrorClass = "";
                }else if( $scope.imageID.length > 21 ){ // 12 and 21 are valid lengths for short/long identifiers
                    // If the imageID length is longer then 12, disable the button and raise error message
                    $scope.isNotValid = true;
                    $scope.imageIDErrorClass = "error";
                }else if( $scope.imageID.length >= 4 &&  $scope.imageID.substring(0, 4) != "emi-" && $scope.imageID.substring(0, 4) != "ami-" ){ 
                    // If the imageID length is longer than 4, and they do not consist of "emi-" or "ami-", disable the button and raise error message
                    $scope.isNotValid = true;
                    $scope.imageIDErrorClass = "error";
                }else if( $scope.imageID.length == 12 || $scope.imageID.length == 21 ){
                    // If the above conditions are met and the image ID length is 12, enable the button
                    $scope.isNotValid = false;
                    $scope.imageIDErrorClass = "";
                }
            }else if( $scope.currentStepIndex == 2 ){
                if( $scope.launchconfigName === '' || $scope.launchconfigName === undefined ){
                    $scope.isNotValid = true;
                }else{
                    $scope.isNotValid = false;
                }
            }else if( $scope.currentStepIndex == 3 ){
                if ($scope.keyPair === '' || $scope.keyPair === undefined) {
                    if ($scope.urlParams.hasOwnProperty('keypair')) {
                        $scope.isNotValid = false;  // Prevent disabling primary button when keypair is preset to "none"
                    } else {
                        $scope.isNotValid = true;
                    }
                } else if ($scope.securityGroups === undefined || $scope.securityGroups.length === 0) {
                    $scope.isNotValid = true;
                } else {
                    $scope.isNotValid = false;
                }
            }
        };
        $scope.setWatcher = function (){
            $scope.$watch('currentStepIndex', function(){
                 if( $scope.currentStepIndex != 1 ){
                     $scope.setWizardFocus($scope.currentStepIndex);
                 }
                $scope.checkRequiredInput();
            });
            $scope.$watch('securityGroups', function(){
                $scope.updateSecurityGroup();
                $scope.checkRequiredInput();
            }, true);
            $scope.$watch('securityGroupVPC', function () {
                $scope.$broadcast('updateVPC', $scope.securityGroupVPC);
            });
            $scope.$watch('securityGroupCollection', function () {
                $scope.updateSecurityGroupChoices();
            });
            $scope.$watch('imageID', function(newID, oldID){
                // Clear the image ID existence check variables
                $scope.existsImage = true;
                $scope.imageIDNonexistErrorClass = "";
                if (newID != oldID && $scope.imageID.length == 12) {
                    $scope.loadImageInfo(newID);
                }
                $scope.checkRequiredInput();
            });
            $scope.$watch('existsImage', function(newValue, oldValue){
                if( newValue != oldValue &&  $scope.existsImage === false ){
                    $scope.isNotValid = true;
                }
            });
            $scope.$watch('launchconfigName', function(){
                $scope.checkRequiredInput();
            });
            $scope.$watch('keyPair', function(){
                $scope.checkRequiredInput();
            });
            $(document).on('open.fndtn.reveal', '[data-reveal]', function () {
                // When a dialog opens, reset the progress button status
                $(this).find('.dialog-submit-button').css('display', 'block');                
                $(this).find('.dialog-progress-display').css('display', 'none');                
                // Broadcast initModal signal to trigger the modal initialization
                $scope.$broadcast('initModal');
            });
            $(document).on('opened.fndtn.reveal', '[data-reveal]', function () {
                // Handle the angular and foundation conflict when setting the select options after the dialog opens
                if( $('#securitygroup_vpc_network').children('option').first().text() === '' ){
                    $('#securitygroup_vpc_network').children('option').first().remove();
                }
                // Reset the field of securitygroup_vpc_network dropdown to the proper value when reopened
                $('#securitygroup_vpc_network option[value="' + $scope.securityGroupVPC + '"]').prop('selected', true);
                $('#securitygroup_vpc_network').trigger('chosen:updated');
            });
            $(document).on('submit', '[data-reveal] form', function () {
                // When a dialog is submitted, display the progress button status
                $(this).find('.dialog-submit-button').css('display', 'none');                
                $(this).find('.dialog-progress-display').css('display', 'block');                
            });
            $(document).on('close.fndtn.reveal', '[data-reveal]', function () {
                var modal = $(this);
                modal.find('input[type="text"]').val('');
                modal.find('input[type="number"]').val('');
                modal.find('input:checked').attr('checked', false);
                modal.find('textarea').val('');
                modal.find('div.error').removeClass('error');
                var chosenSelect = modal.find('select');
                if (chosenSelect.length > 0 && chosenSelect.attr('multiple') === undefined) {
                    chosenSelect.prop('selectedIndex', 0);
                    chosenSelect.trigger("chosen:updated");
                }
            });
            $scope.$watch('inputtype', function(newValue, oldValue) {
                if (newValue != oldValue) {
                    if ($scope.inputtype == 'text') {
                        $timeout(function() {
                            $('#userdata').focus();
                        });
                    }
                }
            });
        };
        $scope.loadImageInfo = function(id) {
            $http({
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'GET',
                url: $scope.imageJsonURL.replace('_id_', id),
                data: ''
            }).success(function (oData) {
                var item = oData.results;
                $scope.imageName = item.name;
                $scope.imagePlatform = item.platform_name;
                $scope.imageRootDeviceType = item.root_device_type;
                $scope.imageLocation = item.location;
                $scope.summarySection.find('.step1').removeClass('hide');
                $scope.$broadcast('setBDM', item.block_device_mapping);
                $scope.existsImage = true;
                $scope.imageIDNonexistErrorClass = "";
            }).error(function (oData) {
                $scope.existsImage = false;
                $scope.imageIDNonexistErrorClass = "error";
            });
        };
        $scope.setFocus = function () {
            $(document).on('opened.fndtn.reveal', '[data-reveal]', function () {
                var modal = $(this);
                var modalID = $(this).attr('id');
                if( modalID.match(/terminate/)  || modalID.match(/delete/) || modalID.match(/release/) ){
                    var closeMark = modal.find('.close-reveal-modal');
                    if(!!closeMark){
                        closeMark.focus();
                    }
                }else{
                    var inputElement = modal.find('input[type!=hidden]').get(0);
                    var modalButton = modal.find('button').get(0);
                    if (!!inputElement && inputElement.value === '') {
                        inputElement.focus();
                    } else if (!!modalButton) {
                        modalButton.focus();
                    }
               }
                // Handle the angular and foundation conflict when setting the select options after the dialog opens
                if( $('#securitygroup_vpc_network').children('option').first().text() === '' ){
                    $('#securitygroup_vpc_network').children('option').first().remove();
                    $('#securitygroup_vpc_network option[value="' + $scope.securityGroupVPC + '"]').prop('selected', true);
                }
            });
        };
        $scope.setWizardFocus = function (stepIdx) {
            var tabElement = $(document).find('#tabStep'+stepIdx).get(0);
            if (!!tabElement) {
                tabElement.focus();
            }
        };
        $scope.visitNextStep = function (nextStep, $event) {
            // Trigger form validation before proceeding to next step
            $scope.launchForm.trigger('validate');
            var currentStep = nextStep - 1,
                tabContent = $scope.launchForm.find('#step' + currentStep),
                invalidFields = tabContent.find('[data-invalid]');
            if (invalidFields.length || $scope.isNotValid === true) {
                invalidFields.focus();
                $event.preventDefault();
                // Handle the case where the tab was clicked to visit the previous step
                if( $scope.currentStepIndex > nextStep){
                    $scope.currentStepIndex = nextStep;
                    $scope.checkRequiredInput();
                }
                return false;
            }
            if (nextStep == 2 && $scope.step1Invalid) { $scope.clearErrors(2); $scope.step1Invalid = false; }
            if (nextStep == 3 && $scope.step2Invalid) { $scope.clearErrors(3); $scope.step2Invalid = false; }
            if (nextStep == 4 && $scope.step3Invalid) { $scope.clearErrors(4); $scope.step3Invalid = false; }

            // since above lines affects DOM, need to let that take affect first
            $timeout(function() {
            // If all is well, click the relevant tab to go to next step
            // since clicking invokes this method again (via ng-click) and
            // one ng action must complete before another can star
                var hash = "step"+nextStep;
                $("#wizard-tabs").children("dd").each(function() {
                    var link = $(this).find("a");
                    if (link.length !== 0) {
                        var id = link.attr("href").substring(1);
                        var $container = $("#" + id);
                        $(this).removeClass("active");
                        $container.removeClass("active");
                        if (id == hash || $container.find("#" + hash).length) {
                            $(this).addClass("active");
                            $container.addClass("active");
                        }
                    }
                });
                // Unhide appropriate step in summary
                $scope.summarySection.find('.step' + nextStep).removeClass('hide');
                $scope.currentStepIndex = nextStep;
                $scope.checkRequiredInput();
                $scope.isHelpExpanded = false;
            },50);
        };
        $scope.clearErrors = function(step) {
            $('#step'+step).find('div.error').each(function(idx, val) {
                $(val).removeClass('error');
            });
        };
        $scope.$on('imageSelected', function($event, item) {
            $scope.imageID = item.id;
            $scope.imageName = item.name;
            $scope.imagePlatform = item.platform_name;
            $scope.imageRootDeviceType = item.root_device_type;
            $scope.imageLocation = item.location;
            $scope.summarySection.find('.step1').removeClass('hide');
            $scope.checkRequiredInput();
        });
        $scope.showCreateKeypairModal = function() {
            var form = $('#launch-config-form');
            var invalid_attr = 'data-invalid';
            form.removeAttr(invalid_attr);
            $(invalid_attr, form).removeAttr(invalid_attr);
            $('.error', form).not('small').removeClass('error');
            $scope.keyPairModal.foundation('reveal', 'open');
        };
        $scope.handleKeyPairCreate = function ($event, createUrl, downloadUrl) {
            $event.preventDefault();
            var form = $($event.target);
            if (form.find('[name="name"]').attr('data-invalid') !== undefined) {
                // prevent invalid (non-ASCII) chars and slashes in key pair name
                return;
            }
            var formData = form.serialize();
            $scope.isLoadingKeyPair = true;
            $http({
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'POST',
                url: createUrl,
                data: formData
            }).success(function (oData) {
                $scope.isLoadingKeyPair = false;
                // Add new key pair to choices and set it as selected
                $scope.keyPairChoices[$scope.newKeyPairName] = $scope.newKeyPairName;
                $scope.keyPair = $scope.newKeyPairName;
                Notify.success(oData.message);
                // Download key pair file
                $.generateFile({
                    csrf_token: form.find('input[name="csrf_token"]').val(),
                    filename: 'not-used',  // server sets this
                    content: 'none',
                    script: downloadUrl
                });
                // Close create key pair modal
                var modal = $scope.keyPairModal;
                modal.foundation('reveal', 'close');
                $scope.newKeyPairName = '';
            }).error(function (oData) {
                $scope.isLoadingKeyPair = false;
                eucaHandleError(oData, status);
            });
        };
        $scope.handleSecurityGroupCreate = function ($event, url) {
            $event.preventDefault();
            $scope.isLoadingSecurityGroup = true;
            var formData = $($event.target).serialize();
            $scope.securityGroupForm.trigger('validate');
            if ($scope.securityGroupForm.find('[data-invalid]').length) {
                return false;
            }
            $http({
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'POST',
                url: url,
                data: formData
            }).success(function (oData) {
                $scope.isLoadingSecurityGroup = false;
                // Add new security group to choices and set it as selected
                var newSecurityGroupID = '';
                if (oData.id) {
                    newSecurityGroupID = oData.id;
                }
                var newlyCreatedSecurityGroupName = $scope.newSecurityGroupName;
                $scope.securityGroupChoicesFullName[newSecurityGroupID] = newlyCreatedSecurityGroupName;
                if (newlyCreatedSecurityGroupName.length > 30) {
                    newlyCreatedSecurityGroupName = newlyCreatedSecurityGroupName.substr(0, 30) + "...";
                }
                if ($scope.securityGroupVPC && $scope.securityGroupVPC != 'None') {
                    newlyCreatedSecurityGroupName = newlyCreatedSecurityGroupName + " (" + $scope.securityGroupVPC + ")";
                }
                $scope.securityGroupChoices[newSecurityGroupID] = newlyCreatedSecurityGroupName;
                $scope.securityGroups.push(newSecurityGroupID);
                var groupRulesObject = JSON.parse($('#rules').val());
                var groupRulesEgressObject = JSON.parse($('#rules_egress').val());
                var groupRulesObjectCombined = groupRulesObject.concat(groupRulesEgressObject); 
                $scope.selectedGroupRules[newSecurityGroupID] = groupRulesObjectCombined; 
                $scope.securityGroupsRules[newSecurityGroupID] = groupRulesObjectCombined;
                // Reset values
                $scope.newSecurityGroupName = '';
                $scope.newSecurityGroupDesc = '';
                $('textarea#rules').val('');
                $('textarea#rules_egress').val('');
                // Timeout is needed for chosen to react after Angular updates the options
                $timeout(function(){
                    $('#securitygroup').trigger('chosen:updated');
                }, 500);
                var modal = $scope.securityGroupModal;
                modal.foundation('reveal', 'close');
                Notify.success(oData.message);
            }).error(function (oData) {
                $scope.isLoadingSecurityGroup = false;
                eucaHandleError(oData, status);
            });
        };
    })
;

