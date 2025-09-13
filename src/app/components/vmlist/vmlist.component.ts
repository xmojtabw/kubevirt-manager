import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { K8sNode } from 'src/app/models/k8s-node.model';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { Subject, lastValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { NetworkAttach } from 'src/app/models/network-attach.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { DataVolumesService } from 'src/app/services/data-volumes.service';
import { DataVolume } from 'src/app/interfaces/data-volume';
import { VirtualMachine } from 'src/app/interfaces/virtual-machine';
import { KubevirtMgrService } from 'src/app/services/kubevirt-mgr.service';
import { FirewallLabels } from 'src/app/models/firewall-labels.model';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { KubeVirtClusterInstanceType } from 'src/app/models/kube-virt-clusterinstancetype';
import { Config } from 'datatables.net';
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';

@Component({
    selector: 'app-vmlist',
    templateUrl: './vmlist.component.html',
    styleUrls: ['./vmlist.component.css']
})
export class VmlistComponent implements OnInit {

    nodeList: K8sNode[] = [];
    vmList: KubeVirtVM[] = [];
    vmiList: KubeVirtVMI[] = [];
    namespaceList: string[] = [];
    clusterInstanceTypeList: KubeVirtClusterInstanceType[] = [];
    networkList: NetworkAttach[] = [];
    netAttachList: NetworkAttach[] = []
    networkCheck: boolean = false;
    firewallLabels: FirewallLabels = new FirewallLabels;

    /*
     * Dynamic Forms
     */
    annotationList: FormGroup;
    labelList: FormGroup;
    diskList: FormGroup;
    nicList: FormGroup;

    /*
     * Dynamic Tables
     */
    vmList_dtOptions: Config = {
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 7 }],
        order: [[1, 'asc']],
    };
    vmList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService,
        private dataVolumesService: DataVolumesService,
        private k8sApisService: K8sApisService,
        private kubeVirtService: KubeVirtService,
        private kubevirtMgrService: KubevirtMgrService,
        private fb: FormBuilder
    ) { 
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });
        this.nicList = this.fb.group({
            nics: this.fb.array([]),
        });
    }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Virtual Machines");
        }
        await this.getNodes();
        await this.getClusterInstanceTypes();
        await this.getVMIs();
        await this.getVMs();
        this.vmList_dtTrigger.next(null);
        await this.checkNetwork();
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });
        this.nicList = this.fb.group({
            nics: this.fb.array([]),
        });
    }

    ngOnDestroy() {
        this.vmList_dtTrigger.unsubscribe();
    }

    /* Getting the Annotations FormArray */
    get annotations(): FormArray {
        return this.annotationList.get('annotations') as FormArray;
    }

    /* Annotation FormGroup */
    createAnnotationGroup(): FormGroup {
        return this.fb.group({
            annotKey: [''],
            annotValue: [''],
        })
    }

    /* Add a new Annotation entry to the Group */
    addAnnotation(): void {
        this.annotations.push(this.createAnnotationGroup());
    }

    /* Remove Annotation entry from the Group */
    removeAnnotation(index: number): void {
        this.annotations.removeAt(index);
    }

    /* Getting all the annotations */
    getAnnotations(): any[] {
        return this.annotationList.value.annotations;
    }

    /*
     * Annotation Form Validation
     */
    validateAnnotations(): boolean {
        let toValidate = this.getAnnotations();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].annotKey == "" || toValidate[i].annotValue == "") {
                    alert("Annotation " + i + " should have Key and Value filled in.")
                    return false;
                } 
            }
        }
        return true;
    }

    /* Getting the Labels FormArray */
    get labels(): FormArray {
        return this.labelList.get('labels') as FormArray;
    }

    /* Label FormGroup */
    createLabelGroup(): FormGroup {
        return this.fb.group({
            labelKey: [''],
            labelValue: [''],
        });
    }

    /* Add a new Label entry to the Group */
    addLabel(): void {
        this.labels.push(this.createLabelGroup());
    }

    /* Remove Label entry from the Group */
    removeLabel(index: number): void {
        this.labels.removeAt(index);
    }

    /* Getting all the labels */
    getLabels(): any[] {
        return this.labelList.value.labels;
    }

    /*
     * Label Form Validation
     */
    validateLabels(): boolean {
        let toValidate = this.getLabels();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].labelKey == "" || toValidate[i].labelValue == "") {
                    alert("Label " + i + " should have Key and Value filled in.")
                    return false;
                }
            }
        }
        return true;
    }

    /* Getting the Disks FormArray */
    get disks(): FormArray {
        return this.diskList.get('disks') as FormArray;
    }

    /* Disk FormGroup */
    createDiskGroup(): FormGroup {
        return this.fb.group({
            diskType: [''],
            diskValue: [''],
            diskKind: ['disk'],
            diskSize: [''],
            diskBootOrder: this.disks.length + 1,
            diskStorageClass: [''],
            diskAccessMode: [''],        
            diskCacheMode: [''],
            diskBus: [''],
            diskMode: ['']
        });
    }

    /* Add a new Disk entry to the Group */
    async addDisk(): Promise<void> {
        this.disks.push(this.createDiskGroup());
        let thisDiskId = this.disks.length - 1;
        await this.diskLoadStorageClasses(thisDiskId);
    }

    /* Remove Disk entry from the Group */
    removeDisk(index: number): void {
        this.disks.removeAt(index);
    }

    /* Getting all the Disks */
    getDisks(): any[] {
        return this.diskList.value.disks;
    }

    /*
     * Disk Form Validation
     */
    validateDisks(): boolean {
        let toValidate = this.getDisks();
        const bootOrderCheck = new Set<number>();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].diskType == "") {
                    alert("Disk " + i + " has no type selected.")
                    return false;
                } else if ((toValidate[i].diskType == "blank" || toValidate[i].diskType == "image") && toValidate[i].diskSize == "") {
                    alert("Disk " + i + " has no size set.");
                    return false;
                } else if ((toValidate[i].diskType == "image" || toValidate[i].diskType == "dv") && toValidate[i].diskValue == "") {
                    alert("Disk " + i + " has no value set.");
                    return false;
                } else if (toValidate[i].diskAccessMode == "") {
                    alert("Disk " + i + " has no Access Mode set.");
                    return false;
                } else if (toValidate[i].diskStorageClass == "") {
                    alert("Disk " + i + " has no Storage Class set.");
                    return false;
                } else if (toValidate[i].diskBootOrder == "" || toValidate[i].diskBootOrder == 0) {
                    alert("Disk " + i + " has an invalid Boot Order value.");
                    return false;
                } else if (bootOrderCheck.has(toValidate[i].diskBootOrder)) {
                    alert("Disk " + i + " has an invalid Boot Order value. The boot order is already in use.");
                    return false;
                }
                bootOrderCheck.add(toValidate[i].diskBootOrder)
            }
        }
        return true;
    }

    /* Getting the NICs FormArray */
    get nics(): FormArray {
        return this.nicList.get('nics') as FormArray;
    }

    /* NIC FormGroup */
    createNicGroup(): FormGroup {
        return this.fb.group({
            networkName: [''],
            networkType: [''],
            networkDriver: [''],
        });
    }

    /* Add a new NIC entry to the Group */
    async addNic(): Promise<void> {
        this.nics.push(this.createNicGroup());
        let thisNicId = this.nics.length - 1;
        await this.loadNetworkOptions(thisNicId);
    }

    /* Remove NIC entry from the Group */
    removeNic(index: number): void {
        this.nics.removeAt(index);
    }

    /* Getting all the NICs */
    getNics(): any[] {
        return this.nicList.value.nics;
    }

    /*
     * NIC Form Validation
     */
    validateNics(): boolean {
        let toValidate = this.getNics();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].networkName == "") {
                    alert("NIC " + i + " has no Network selected.")
                    return false;
                } else if (toValidate[i].networkType == "") {
                    alert("NIC " + i + " has no Type selected.");
                    return false;
                }
            }
        }
        return true;
    }

    /*
     * Load Nodes
     */
    async getNodes(): Promise<void> {
        this.nodeList = [];
        try {
            let currentNode = new K8sNode;
            /* auto-selects node when power on vm */
            currentNode.name = "auto-select";
            this.nodeList.push(currentNode);
            currentNode = new K8sNode();
            const data = await lastValueFrom(this.k8sService.getNodes());
            let nodes = data.items;
            for (let i = 0; i < nodes.length; i++) {
                currentNode = new K8sNode();
                currentNode.name = nodes[i].metadata["name"];
                this.nodeList.push(currentNode);
            }
        } catch (e: any) {
            console.log(e.error.message);
        }
    }

    /*
     * Load VM List
     */
    async getVMs(): Promise<void> {
        this.vmList = [];
        let currentVm = new KubeVirtVM;
        const data = await lastValueFrom(this.kubeVirtService.getVMs());
        let vms = data.items;
        for (let i = 0; i < vms.length; i++) {
            currentVm = new KubeVirtVM();
            currentVm.name = vms[i].metadata["name"];
            currentVm.namespace = vms[i].metadata["namespace"];
            currentVm.creationTimestamp = new Date(vms[i].metadata["creationTimestamp"]);
            try {
                currentVm.status = vms[i].status["printableStatus"].toLowerCase();
                /* Working around a bug when scaling down and VM stuck in terminating */
                if(currentVm.status.toLowerCase() == "terminating") {
                    currentVm.running = false;
                } else if (currentVm.status.toLowerCase() == "running") {
                    currentVm.running = true;
                } else {
                    currentVm.running = vms[i].spec["running"];
                }
            } catch (e: any) {
                currentVm.status = "";
                currentVm.running = false;
                console.log("Error loading VM status");
            }
            try {
                currentVm.runStrategy = vms[i].spec["runStrategy"];
            } catch (e: any) {
                currentVm.runStrategy = "";
                console.log("Error loading VM runStrategy");
            }
            if (vms[i].spec.template.spec.nodeSelector !== undefined && vms[i].spec.template.spec.nodeSelector["kubernetes.io/hostname"] !== undefined && vms[i].spec.template.spec.nodeSelector["kubernetes.io/hostname"] != "") { 
                currentVm.nodeSel = vms[i].spec.template.spec.nodeSelector["kubernetes.io/hostname"];
            } else {
                currentVm.nodeSel = "auto-select";
            }

            /* Getting VM Type */
            try {
                currentVm.instType = vms[i].spec.instancetype.name;
            } catch(e: any) {
                currentVm.instType = "custom";
            }

            if(currentVm.instType == "custom") {
                try {
                    /* Custom VM has cpu / mem parameters */
                    currentVm.cores = vms[i].spec.template.spec.domain.cpu["cores"];
                    currentVm.sockets = vms[i].spec.template.spec.domain.cpu["sockets"];
                    currentVm.threads = vms[i].spec.template.spec.domain.cpu["threads"];
                    currentVm.memory = vms[i].spec.template.spec.domain.resources.requests["memory"];
                } catch (e: any){
                    currentVm.cores = currentVm.cores || 0;
                    currentVm.sockets = currentVm.sockets || 0;
                    currentVm.threads = currentVm.threads || 0;
                    currentVm.memory = currentVm.memory || "N/A";
                    console.log("error getting cpu/memory for namespace: " + currentVm.namespace + " / vm: " + currentVm.name);
                }

            } else {
                /* load vCPU / Mem from type */
                for(let j = 0; j < this.clusterInstanceTypeList.length; j++) {
                    if(this.clusterInstanceTypeList[j].name == currentVm.instType) {
                        currentVm.cores = this.clusterInstanceTypeList[j].cores;
                        currentVm.memory = this.clusterInstanceTypeList[j].memory;
                        currentVm.sockets = this.clusterInstanceTypeList[j].sockets;
                        currentVm.threads = this.clusterInstanceTypeList[j].threads;
                    }
                }
            }

            if(vms[i].status["ready"] != null) {
                currentVm.ready = vms[i].status["ready"];
            }

            if(currentVm.running && currentVm.status && currentVm.status == "running") {
                for(let k = 0; k < this.vmiList.length; k++) {
                    if(this.vmiList[k].namespace == currentVm.namespace && this.vmiList[k].name == currentVm.name) {
                        currentVm.vmi = this.vmiList[k];
                        currentVm.nodeSel = currentVm.vmi.nodeName;
                    }
                }
            }

            this.vmList.push(currentVm);
        }
    }

    /*
     * Load VMIs
     */
    async getVMIs(): Promise<void> {
        let currentVmi = new KubeVirtVMI;
        try {
            const datavmi = await lastValueFrom(this.kubeVirtService.getVMis());
            let vmis = datavmi.items;
            for (let i = 0; i < vmis.length; i++) {
                currentVmi = new KubeVirtVMI();
                currentVmi.name = vmis[i].metadata["name"];
                currentVmi.namespace = vmis[i].metadata["namespace"];

                /* Only works with guest-agent installed if not on podNetwork */
                try {
                    /* In case of dual NIC, test which one is providing IP */
                    if(vmis[i].status.interfaces[0]["ipAddress"] != null) {                        
                        currentVmi.ifAddr = vmis[i].status.interfaces[0]["ipAddress"];
                        currentVmi.ifName = vmis[i].status.interfaces[0]["name"];
                    } else {
                        currentVmi.ifAddr = vmis[i].status.interfaces[1]["ipAddress"];
                        currentVmi.ifName = vmis[i].status.interfaces[1]["name"];
                    }
                } catch(e: any) {
                    currentVmi.ifAddr = "";
                    currentVmi.ifName = "";
                }

                currentVmi.nodeName = vmis[i].status["nodeName"];
                this.vmiList.push(currentVmi)
            }
        } catch (e: any) {
            console.log("ERROR Retrieving VMI list");
        }
    }

    /*
     * Load Instance Types
     */
    async getClusterInstanceTypes(): Promise<void> {
        let currentClusterInstanceType = new KubeVirtClusterInstanceType;
        try {
            const datacit = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            let cits = datacit.items;
            for (let i = 0; i < cits.length; i++) {
                currentClusterInstanceType = new KubeVirtClusterInstanceType();
                try {
                    currentClusterInstanceType.name = cits[i].metadata.name;
                    currentClusterInstanceType.cores = cits[i].spec.cpu["guest"];
                    currentClusterInstanceType.memory = cits[i].spec.memory["guest"];
                    currentClusterInstanceType.sockets = 1;
                    currentClusterInstanceType.threads = 1;
                } catch (e: any) {
                    currentClusterInstanceType.sockets = 0;
                    currentClusterInstanceType.threads = 0;
                    currentClusterInstanceType.cores = 0;
                    currentClusterInstanceType.memory = "";
                }
                this.clusterInstanceTypeList.push(currentClusterInstanceType);
            }
        } catch (e: any) {
            console.log("ERROR Retrieving ClusterInstanceType list");
        }
    }

    /*
     * Show New VM Window
     */
    async showNewVm(): Promise<void> {

        let i = 0;
        let modalDiv = document.getElementById("modal-newvm");
        let modalTitle = document.getElementById("newvm-title");
        let modalBody = document.getElementById("newvm-value");

        let selectorNamespacesField = document.getElementById("newvm-namespace");
        let selectorTypeField = document.getElementById("newvm-type");
        let selectorPCField = document.getElementById("newvm-pc");
        let selectorNewNodeField = document.getElementById("newvm-node");

        let data: any;

        /* Set Node for VM */
        let nodeSelectorOptions = "";
        for (i = 0; i < this.nodeList.length; i++) {
            nodeSelectorOptions += "<option value=" + this.nodeList[i].name +">" + this.nodeList[i].name + "</option>\n";
        }

        /* Load Namespace List and Set Selector */
        let nsSelectorOptions = "";
        try {
            data = await lastValueFrom(this.k8sService.getNamespaces());
            for (i = 0; i < data.items.length; i++) {
                this.namespaceList.push(data.items[i].metadata["name"]);
                nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e.error.message);
        }

        /* Show new window
         * before loading everything
         * to avoid delays
         */
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Virtual Machine");
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }


        /* Load ClusterInstanceType List and Set Selector */
        let typeSelectorOptions = "<option value=none></option>";
        try {
            data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            for (i = 0; i < data.items.length; i++) {
                typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e.error.message);
        }

        /* Load Storage Class List and Set Selector */
        let prioritySelectorOptions = "";
        try {
            data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
            for (i = 0; i < data.items.length; i++) {
                if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                    prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
                } else {
                    prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
                }
            }
        } catch (e: any) {
            console.log(e.error.message);
        }

        if (selectorNewNodeField != null) {
            selectorNewNodeField.innerHTML = nodeSelectorOptions;
        }

        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        if (selectorTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorTypeField.innerHTML = typeSelectorOptions;
        }

        if (selectorPCField != null) {
            selectorPCField.innerHTML = prioritySelectorOptions;
        }

    }

    /*
     * New VM: Load Available Storage Classes
     */
    async diskLoadStorageClasses(frmIndex: number) {
        /* Load Storage Class List and Set Selector  */
        let storageSelectorOptions = "<option selected></option>\n";
        try {
            let data = await lastValueFrom(this.k8sApisService.getStorageClasses());
            for (let i = 0; i < data.items.length; i++) {
                storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e.error.message);
        }

        let diskStorageClassField = document.getElementById("diskStorageClass-" + frmIndex.toString());

        if (diskStorageClassField != null) {
            diskStorageClassField.innerHTML = storageSelectorOptions;
        }
    }

    /*
     * New VM: Create the New VM
     */
    async applyNewVm(
        newvmname: string,
        newvmnamespace: string,
        newvmnode: string,
        newvmrunstrategy: string,
        newvmtype: string,
        newvmcpumemsockets: string,
        newvmcpumemcores: string,
        newvmcpumemthreads: string,
        newvmcpumemmemory: string,
        newvmpriorityclass: string,
        newvmfirmware: string,
        newvmsecureboot: string,
        newvmuserdatausername: string,
        newvmuserdataauth: string,
        newvmuserdatapassword: string,
        newvmuserdatassh: string,
        newvmcloudinitip: string,
        newvmcloudinitnetmask: string,
        newvmcloudinitgw: string,
        newvmcloudinitdns1: string,
        newvmcloudinitdns2: string,
        newpoolinitscript: string, 
        newvmwindowsinitscript: string
    ) {
        /* Basic Form Fields Check/Validation */
        if(newvmname == "" || newvmnamespace == "") {
            alert("You need to fill in the name and namespace fields!");
        } else if (!this.validateLabels()) {
            alert("Please check the labels of your service!");
        } else if (!this.validateAnnotations()) {
            alert("Please check the annotations of your service!");
        } else if(this.checkVmExists(newvmname, newvmnamespace)) {
            alert("VM with name/namespace combination already exists!");
        } else if(newvmtype.toLowerCase() == "none" || newvmtype.toLowerCase() == "") {
            alert("Please select a valid VM type!");
        } else if(this.validateAnnotations() && this.validateLabels() && this.validateDisks() && this.validateNics()){

            let thisVirtualMachine: VirtualMachine = {
                apiVersion: "kubevirt.io/v1alpha3",
                kind: "VirtualMachine",
                metadata: {
                    name: newvmname,
                    namespace: newvmnamespace,
                },
                spec: {
                    runStrategy: newvmrunstrategy,
                    template: {
                        metadata: {},
                        spec: {
                            domain: {
                                devices: {
                                    disks: {},
                                    interfaces: {},
                                    networkInterfaceMultiqueue: true
                                }
                            },
                            networks: {},
                            volumes: {}
                        }
                    }
                }
            }

            /* Our Arrays */
            let networks = [];
            let disks = [];
            let interfaces = [];
            let volumes = [];

            /* Load Custom Labels OPTIONAL */
            let labelsForm = this.getLabels();
            let tmpLabels = {};
            for (let i = 0; i < labelsForm.length; i++) {
                let thisLabel = {
                    [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
                };
                Object.assign(tmpLabels, thisLabel);
            }

            /* Load Annotations OPTIONAL */
            let annotationsForm = this.getAnnotations();
            let tmpAnnotations = {};
            for (let i = 0; i < annotationsForm.length; i++) {
                let thisAnnotation = {
                    [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
                };
                Object.assign(tmpAnnotations, thisAnnotation);
            }

            /* Populate our VM with our Labels and Load */
            Object.assign(tmpLabels, { 'kubevirt.io/domain': newvmname });
            Object.assign(tmpLabels, { 'kubevirt-manager.io/managed': "true" });
            Object.assign(tmpLabels, { [this.firewallLabels.VirtualMachine]: newvmname });
            thisVirtualMachine.metadata.labels = tmpLabels;
            thisVirtualMachine.spec.template.metadata.labels = tmpLabels;

            /* Load Annotations */
            thisVirtualMachine.metadata.annotations = tmpAnnotations;
            thisVirtualMachine.spec.template.metadata.annotations = tmpAnnotations;


            /* Node Selector */
            if(newvmnode != "auto-select") {
                thisVirtualMachine.spec.template.spec.nodeSelector = {"kubernetes.io/hostname": newvmnode};
            } else {
                thisVirtualMachine.spec.template.spec.evictionStrategy = "LiveMigrate";
            }


            let cloudconfig  = "#cloud-config\n";
                cloudconfig += "manage_etc_hosts: true\n";
                cloudconfig += "hostname: " + newvmname + "\n";
                cloudconfig += "ssh_pwauth: true\n";
            let netconfig  ="version: 1\n";
                netconfig += "config:\n";
                netconfig += "    - type: physical\n";
                netconfig += "      name: enp1s0\n";
                netconfig += "      subnets:\n";

            /* Disk setup */
            let thisDiskList = this.getDisks();
            for(let i = 0; i < thisDiskList.length; i++) {
                let diskObject = {};
                let deviceObject = {};
                let actualDisk = thisDiskList[i];
                let actualDiskName = newvmnamespace + "-"+ newvmname + "-disk" + i.toString();
                if (actualDisk.diskMode == "") {
                    actualDisk.diskMode = "Filesystem";
                }
                let diskDataVolume: DataVolume = {
                    apiVersion: "cdi.kubevirt.io/v1beta1",
                    kind: "DataVolume",
                    metadata: {
                        name: actualDiskName,
                        namespace: newvmnamespace,
                        annotations: {
                            "cdi.kubevirt.io/storage.deleteAfterCompletion": "false",
                        }
                    },
                    spec: {
                        pvc: {
                            storageClassName: actualDisk.diskStorageClass,
                            volumeMode: actualDisk.diskMode,
                            accessModes:[
                                actualDisk.diskAccessMode
                            ],
                            resources: {
                                requests: {
                                    storage: actualDisk.diskSize + "Gi",
                                }
                            }
                        },
                        source: {}
                    }
                }

                if(actualDisk.diskType == "image") {
                    try {
                        let imageData = await lastValueFrom(await this.kubevirtMgrService.getImage(newvmnamespace, actualDisk.diskValue));
                        switch(imageData.spec.type) {
                            case "http":
                                diskDataVolume.spec.source = {
                                    http: {
                                        url: imageData.spec.http.url
                                    }
                                }
                                break;
                            case "gcs":
                                diskDataVolume.spec.source = {
                                    gcs: {
                                        url: imageData.spec.gcs.url
                                    }
                                }
                                break;
                            case "s3":
                                diskDataVolume.spec.source = {
                                    s3: {
                                        url: imageData.spec.s3.url
                                    }
                                }
                                break;
                            case "registry":
                                diskDataVolume.spec.source = {
                                    registry: {
                                        url: imageData.spec.registry.url
                                    }
                                }
                                break;
                            case "pvc":
                                diskDataVolume.spec.source = {
                                    pvc: {
                                        name: imageData.spec.pvc.name,
                                        namespace: imageData.spec.pvc.namespace
                                    }
                                }
                                break;
                        }
                    } catch (e: any) {
                        alert(e.error.message);
                        console.log(e.error.message);
                        throw new Error("Error loading disk" + i + " image data!");
                    }
                    try {
                        let diskData = await lastValueFrom(this.dataVolumesService.createDataVolume(diskDataVolume));
                        if(actualDisk.diskCacheMode != "") {
                            if(actualDisk.diskBus != "") {
                                diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, [actualDisk.diskKind]: {'bus': actualDisk.diskBus}};
                            } else {
                                diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, [actualDisk.diskKind]: {}};
                            }
                        } else {
                            if(actualDisk.diskBus != "") {
                                diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, [actualDisk.diskKind]: {'bus': actualDisk.diskBus}};
                            } else {
                                diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, [actualDisk.diskKind]: {}};
                            }
                        }
                        deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDiskName}};
                        volumes.push(deviceObject);
                        disks.push(diskObject);
                        console.log(diskObject)
                    } catch (e: any) {
                        alert(e.error.message);
                        console.log(e.error.message);
                        throw new Error("Error creating disk" + i.toString() + " from Image!");
                    }
                } else if (actualDisk.diskType == "blank") {
                    diskDataVolume.spec.source = {
                        blank: {}
                    }
                    try {
                        let disk1data = await lastValueFrom(this.dataVolumesService.createDataVolume(diskDataVolume));
                        if(actualDisk.diskCacheMode != "") {
                            if(actualDisk.diskBus != "") {
                                diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, 'disk': {'bus': actualDisk.diskBus}};
                            } else {
                                diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, 'disk': {}};
                            }
                        } else {
                            if(actualDisk.diskBus != "") {
                                diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, 'disk': {'bus': actualDisk.diskBus}};
                            } else {
                                diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, 'disk': {}};
                            }
                        }
                        deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDiskName}};
                        volumes.push(deviceObject);
                        disks.push(diskObject);
                        console.log(diskObject)
                    } catch (e: any) {
                        alert(e.error.message);
                        console.log(e.error.message);
                        throw new Error("Error creating disk" + i.toString() + " from Blank!");
                    }
                } else if (actualDisk.diskType == "dv") {
                    /* Use Existing DataVolume */
                    if(actualDisk.diskCacheMode != "") {
                        if(actualDisk.diskBus != "") {
                            diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, 'disk': {'bus': actualDisk.diskBus}};
                        } else {
                            diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'bootOrder': actualDisk.diskBootOrder, 'disk': {}};
                        }
                    } else {
                        if(actualDisk.diskBus != "") {
                            diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, 'disk': {'bus': actualDisk.diskBus}};
                        } else {
                            diskObject = { 'name': "disk" + i.toString(), 'bootOrder': actualDisk.diskBootOrder, 'disk': {}};
                        }
                    }
                    deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDisk.diskValue }};
                    volumes.push(deviceObject);
                    disks.push(diskObject);
                    console.log(diskObject)
                }
            }

            /* UserData Setup */
            if(newvmuserdatausername != "") {
                Object.assign(thisVirtualMachine.metadata.labels, { "cloud-init.kubevirt-manager.io/username" : newvmuserdatausername });
                Object.assign(thisVirtualMachine.spec.template.metadata.labels, { "cloud-init.kubevirt-manager.io/username" : newvmuserdatausername });
            }
            if(newvmuserdataauth.toLowerCase() == "ssh") {
                if (newvmuserdatassh != "") {
                    let sshLabels = {};
                    Object.assign(sshLabels, { "kubevirt-manager.io/ssh" : "true" });
                    Object.assign(sshLabels, { "cloud-init.kubevirt-manager.io/ssh" : newvmuserdatassh});
                    Object.assign(thisVirtualMachine.metadata.labels, sshLabels);
                    try {
                        let sshSecret = await lastValueFrom(this.k8sService.getSecret(newvmnamespace, newvmuserdatassh));
                        let sshKey = sshSecret.data["ssh-privatekey"];
                        cloudconfig += "chpasswd:\n";
                        cloudconfig += "  expire: true\n";
                        cloudconfig += "users:\n";
                        cloudconfig += "  - name: " + newvmuserdatausername + "\n";
                        cloudconfig += "    lock_passwd: false\n";
                        cloudconfig += "    sudo: ALL=(ALL) NOPASSWD:ALL\n";
                        cloudconfig += "    shell: /bin/bash\n";
                        cloudconfig += "    ssh_authorized_keys:\n";
                        cloudconfig += "      - " + atob(sshKey) + "\n";
                    } catch (e: any) {
                        alert(e.error.message);
                        console.log(e.error.message);
                    }
                }
            } else {
                if (newvmuserdatapassword != "") {
                    cloudconfig += "chpasswd:\n";
                    cloudconfig += "  expire: true\n";
                    cloudconfig += "  users:\n";
                    cloudconfig += "    - {name: " + newvmuserdatausername + ", password: " + newvmuserdatapassword + ", type: text}\n"
                    cloudconfig += "users:\n";
                    cloudconfig += "  - name: " + newvmuserdatausername + "\n";
                    cloudconfig += "    lock_passwd: false\n";
                    cloudconfig += "    sudo: ALL=(ALL) NOPASSWD:ALL\n";
                    cloudconfig += "    shell: /bin/bash\n";
                    cloudconfig += "    plain_text_passwd: " + newvmuserdatapassword + "\n";
                }
            }

            /* Init Script Setup */
            if(newpoolinitscript != "") {
                cloudconfig += "runcmd: \n";
                for (const line of newpoolinitscript.split(/[\r\n]+/)){
                    cloudconfig += "  - " + line + "\n";
                }
            }

            /* NetworkData Setup */
            if(newvmcloudinitip != "") {
                netconfig += "      - type: static\n";
                netconfig += "        address: \'" + newvmcloudinitip + "\'\n";
                netconfig += "        netmask: \'" + newvmcloudinitnetmask + "\'\n";
                netconfig += "        gateway: \'" + newvmcloudinitgw + "\'\n";
            } else {
                netconfig += "      - type: dhcp\n";
            }

            /* NetworkData Setup: DNS */
            if(newvmcloudinitdns1 != "") {
                netconfig += "    - type: nameserver\n";
                netconfig += "      address:\n";
                netconfig += "      - \'" + newvmcloudinitdns1 + "\'\n";
                if (newvmcloudinitdns2 != "") {
                netconfig += "      - \'" + newvmcloudinitdns2 + "\'\n";
                }
            } else {
                netconfig += "    - type: nameserver\n";
                netconfig += "      address:\n";
                netconfig += "      - \'8.8.8.8\'\n";
                netconfig += "      - \'8.8.4.4\'\n";
            }
            /* User Data and Configs */ 
            let diskUserData;
            let deviceUserData;
            if (newvmwindowsinitscript != "") {
                /*Windows vm configs*/ 
                diskUserData = {'name': "cloudinitdisk", 'cdrom': {'bus': "sata"}}; // Windows cloudinit needs to be on sata cdrom
                deviceUserData = {'name': "cloudinitdisk", 'cloudInitNoCloud': {'userDataBase64': btoa(newvmwindowsinitscript)}};
                disks.splice(1,0, diskUserData); // insert at index 1 to be always D 
                volumes.push(deviceUserData);
            }
            else 
            {
                /* Adding UserData/NetworkData device for linux or other OSs   */
                diskUserData = {'name': "disk" + this.disks.length.toString(), 'disk': {'bus': "virtio"}};
                deviceUserData = {'name': "disk" + this.disks.length.toString(), 'cloudInitNoCloud': {'userData': cloudconfig, 'networkData': netconfig}};
                volumes.push(deviceUserData);
                disks.push(diskUserData);
            }

        
            /* NICs Setup */
            let thisNICList = this.getNics();
            for(let i = 0; i < thisNICList.length; i++) {
                /* networkName, networkType */
                let thisNIC = thisNICList[i];
                let netObject = {};
                let ifaceObject = {};
                if(thisNIC.networkName != "podNetwork") {
                    netObject = {'name': "net" + i.toString(), 'multus': {'networkName': thisNIC.networkName}};
                    let network_split = thisNIC.networkName.split("/")
                    if(i > 0) {
                        let theseNetworks: string[] = [];
                        theseNetworks.push(network_split[1])
                        for(let j = 0; j < i; j++) {
                            let otherNIC = thisNICList[j];
                            if(otherNIC.networkName != "podNetwork") {
                                let othernic_network_split = otherNIC.networkName.split("/")
                                if (othernic_network_split[1] !== undefined) {
                                    theseNetworks.push(othernic_network_split[1]);
                                }
                            }
                        }
                        if (theseNetworks.length > 0) {
                            Object.assign(thisVirtualMachine.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': theseNetworks.join(".") });
                            Object.assign(thisVirtualMachine.spec.template.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': theseNetworks.join(".") });
                        } else {
                            Object.assign(thisVirtualMachine.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': network_split[1] });
                            Object.assign(thisVirtualMachine.spec.template.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': network_split[1] });
                        }
                    } else {
                        Object.assign(thisVirtualMachine.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': network_split[1] });
                        Object.assign(thisVirtualMachine.spec.template.metadata.labels, { 'k8s.v1.cni.cncf.io/networks': network_split[1] });
                    }
                } else {
                    netObject = {'name': "net" + i.toString(), 'pod': {}};
                }

                let nicDriver = "virtio"
                if(thisNIC.networkDriver != "") {
                    nicDriver = thisNIC.networkDriver
                }
                
                if(thisNIC.networkType == "bridge") {
                    ifaceObject = {'name': "net" + i.toString(), 'bridge': {}, 'model': nicDriver}; 
                } else if(thisNIC.networkType == "macvtap") {
                    ifaceObject = {'name': "net" + i.toString(), 'binding': {'name': 'macvtap'}, 'model': nicDriver};
                } else {
                    ifaceObject = {'name': "net" + i.toString(), 'masquerade': {}, 'model': nicDriver};
                }
                networks.push(netObject);
                interfaces.push(ifaceObject);
            }

            /* Assigning Arrays  */
            if(networks.length > 0) { thisVirtualMachine.spec.template.spec.networks = networks; } 
            if(disks.length > 0) { thisVirtualMachine.spec.template.spec.domain.devices.disks = disks; }
            if(interfaces.length > 0) { thisVirtualMachine.spec.template.spec.domain.devices.interfaces = interfaces; }
            if(volumes.length > 0) { thisVirtualMachine.spec.template.spec.volumes = volumes; } 

            /* Firmware and Secure Boot */
            if(newvmfirmware.toLowerCase() == "bios") {
                let firmware = { 'bootloader': { 'bios': {}}};
                thisVirtualMachine.spec.template.spec.domain.firmware = firmware;
            } else if (newvmfirmware.toLowerCase() == "uefi") {
                let firmware = {};
                if(newvmsecureboot == "true") {
                    firmware = { 'bootloader': { 'efi': { 'secureBoot': true }}};
                } else {
                    firmware = { 'bootloader': { 'efi': { 'secureBoot': false }}};
                }
                let features = { 'smm': { 'enabled': true }};
                thisVirtualMachine.spec.template.spec.domain.firmware = firmware;
                thisVirtualMachine.spec.template.spec.domain.features = features;
            } else {
                let firmware = { 'bootloader': { 'bios': {}}};
                thisVirtualMachine.spec.template.spec.domain.firmware = firmware;
            }

            /* Create the VM */
            if(newvmtype.toLowerCase() == "custom") {
                thisVirtualMachine.spec.template.spec.domain.cpu = {
                    cores: Number(newvmcpumemcores),
                    threads: Number(newvmcpumemthreads),
                    sockets: Number(newvmcpumemsockets)
                };
                thisVirtualMachine.spec.template.spec.domain.resources = {
                    requests: {
                        memory: newvmcpumemmemory + "Gi"
                    }
                };

                if (!thisVirtualMachine.spec.template.spec.domain.memory) {
                    thisVirtualMachine.spec.template.spec.domain.memory = { guest: "" };
                }
                thisVirtualMachine.spec.template.spec.domain.memory.guest = newvmcpumemmemory + "Gi";


            } else {
                thisVirtualMachine.spec.template.spec.priorityClassName = newvmpriorityclass;
                thisVirtualMachine.spec.instancetype = {  
                    kind: "VirtualMachineClusterInstancetype",
                    name: newvmtype
                };
            }
            try {
                console.log("Creating VM: ", thisVirtualMachine);
                let data = await lastValueFrom(this.kubeVirtService.createVm(thisVirtualMachine));
                this.hideComponent("modal-newvm");
                this.fullReload();
            } catch (e: any) {
                alert(e.error.message);
                console.log(e.error.message);
            }
        }
    }

    /*
     * Show Resize Window
     */
    showResize(vmName: string, vmNamespace: string, vmSockets: number, vmCores: number, vmThreads: number, vmMemory: string): void {
        let modalDiv = document.getElementById("modal-resize");
        let modalTitle = document.getElementById("resize-title");
        let modalBody = document.getElementById("resize-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Resize: " + vmName);
        }
        if(modalBody != null) {
            let resizeNameField = document.getElementById("resize-name");
            let resizeNamespaceField = document.getElementById("resize-namespace");
            let resizeSocketsField = document.getElementById("resize-sockets");
            let resizeCoresField = document.getElementById("resize-cores");
            let resizeThreadsField = document.getElementById("resize-threads");
            let resizeMemoryField = document.getElementById("resize-memory");
            if(resizeNameField != null && resizeNamespaceField != null && resizeSocketsField != null && resizeCoresField != null && resizeThreadsField != null && resizeMemoryField != null) {
                resizeNameField.setAttribute("value", vmName);
                resizeNamespaceField.setAttribute("value", vmNamespace);
                resizeSocketsField.setAttribute("placeholder", vmSockets.toString());
                resizeCoresField.setAttribute("placeholder", vmCores.toString());
                resizeThreadsField.setAttribute("placeholder", vmThreads.toString());
                resizeMemoryField.setAttribute("placeholder", vmMemory.toString());
                resizeSocketsField.setAttribute("value", vmSockets.toString());
                resizeCoresField.setAttribute("value", vmCores.toString());
                resizeThreadsField.setAttribute("value", vmThreads.toString());
                resizeMemoryField.setAttribute("value", vmMemory.replace("Gi", "").toString());
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Resize Virtual Machine
     */
    async applyResize(sockets: string, cores: string, threads: string, memory: string): Promise<void> {
        let resizeNameField = document.getElementById("resize-name");
        let resizeNamespaceField = document.getElementById("resize-namespace");
        if(sockets != "" && cores != "" && threads != "" && memory != "" && resizeNameField != null && resizeNamespaceField != null) {
            let resizeName = resizeNameField.getAttribute("value");
            let resizeNamespace = resizeNamespaceField.getAttribute("value");
            if(resizeName != null && resizeNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.scaleVm(resizeNamespace, resizeName, cores, threads, sockets, memory));
                    this.hideComponent("modal-resize");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e.error.message);
                }
            }
        }
    }

    /*
     * Show Delete Window
     */
    showDelete(vmName: string, vmNamespace: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let vmNameInput = document.getElementById("delete-name");
            let vmNamespaceInput = document.getElementById("delete-namespace");
            if(vmNameInput != null && vmNamespaceInput != null) {
                vmNameInput.setAttribute("value", vmName);
                vmNamespaceInput.setAttribute("value", vmNamespace);
                modalBody.replaceChildren("Are you sure you want to delete " + vmName + " on namespace: " + vmNamespace + "?");
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Delete Virtual Machine
     */
    async applyDelete(): Promise<void> {
        let vmNameInput = document.getElementById("delete-name");
        let vmNamespaceInput = document.getElementById("delete-namespace");
        if(vmNameInput != null && vmNamespaceInput != null) {
            let vmName = vmNameInput.getAttribute("value");
            let vmNamespace = vmNamespaceInput.getAttribute("value");
            if(vmName != null && vmNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
                    this.hideComponent("modal-delete");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e.error.message);
                }
            }
        }
    }


    /*
     * Show Type Window
     */
    async showType(vmName: string, vmNamespace: string): Promise<void> {
        let modalDiv = document.getElementById("modal-type");
        let modalTitle = document.getElementById("type-title");
        let modalBody = document.getElementById("type-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Change VM Type");
        }
        if(modalBody != null) {
            let vmNameInput = document.getElementById("type-vm");
            let vmNamespaceInput = document.getElementById("type-namespace");
            let selectorTypeFiled = document.getElementById("changevm-type");
            if(vmNameInput != null && vmNamespaceInput != null) {
                vmNameInput.setAttribute("value", vmName);
                vmNamespaceInput.setAttribute("value", vmNamespace);
                /* Load ClusterInstanceTyle List and Set Selector */
                let typeSelectorOptions = "";
                let data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
                for (let i = 0; i < data.items.length; i++) {
                    typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
                }
                if (selectorTypeFiled != null) {
                    selectorTypeFiled.innerHTML = typeSelectorOptions;
                }
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Change VM Type
     */
    async applyType(vmType: string): Promise<void> {
        let vmNameInput = document.getElementById("type-vm");
        let vmNamespaceInput = document.getElementById("type-namespace");
        if(vmNameInput != null && vmNamespaceInput != null) {
            let vmName = vmNameInput.getAttribute("value");
            let vmNamespace = vmNamespaceInput.getAttribute("value");
            if(vmName != null && vmNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.changeVmType(vmNamespace, vmName, vmType));
                    this.hideComponent("modal-type");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e.error.message);
                }
            }
        }
    }

    /*
     * VM Basic Operations (start, stop, etc...)
     */
    async vmOperations(vmOperation: string, vmNamespace: string, vmName: string): Promise<void> {
        if(vmOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "reboot"){
            var data = await lastValueFrom(this.kubeVirtService.restartVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "pause") {
            const data = await lastValueFrom(this.kubeVirtService.pauseVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "unpause") {
            const data = await lastValueFrom(this.kubeVirtService.unpauseVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.fullReload();
        } else if (vmOperation == "migrate") {
            const data = await lastValueFrom(this.kubeVirtService.migrateVm(vmNamespace, vmName));
            this.fullReload();
        }
    }

    /*
     * New VM: Change Firmware
     */
    async onChangeFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newvm-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * New VM: Control Disk Options
     */
    async onChangeDisk(diskNamespace: string, frmIndex: number) {
        let diskTypeField = document.getElementById("diskType-" + frmIndex.toString());
        let diskValueField = document.getElementById("diskValue-" + frmIndex.toString());
        let diskSizeField = document.getElementById("diskSize-" + frmIndex.toString());
        if(diskTypeField != null && diskTypeField instanceof HTMLSelectElement) {
            let diskType = diskTypeField.value;
            if (diskType == "blank") {
                if (diskValueField != null && diskSizeField != null) {
                    diskValueField.setAttribute("disabled", "disabled");
                    diskSizeField.removeAttribute("disabled");
                }
            } else if (diskType == "image") {
                if(diskValueField != null && diskSizeField != null) {
                    diskValueField.innerHTML = await this.loadImageOptions(diskNamespace);
                    diskValueField.removeAttribute("disabled");
                    diskSizeField.removeAttribute("disabled");
                }
            } else if (diskType == "dv") {
                if (diskValueField != null && diskSizeField != null) {
                    diskValueField.innerHTML = await this.loadDiskOptions(diskNamespace);
                    diskValueField.removeAttribute("disabled");
                    diskSizeField.setAttribute("disabled", "disabled");
                }
            }
        }
    }

    /*
     * New VM: Load Disk Options
     */
    async loadDiskOptions(dvNamespace: string) {
        let diskSelectorOptions = "<option selected></option>\n";
        try {
            let data = await lastValueFrom(await this.dataVolumesService.getNamespacedDataVolumes(dvNamespace));
            let disks = data.items;
            for (let i = 0; i < disks.length; i++) {

                diskSelectorOptions += "<option value=" + disks[i].metadata["name"] +">" + disks[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e.error.message);
        }
        return diskSelectorOptions;
    }

    /*
     * New VM: Load Image Options
     */
    async loadImageOptions(imgNamespace: string) {
        let imgSelectorOptions = "<option selected></option>\n";
        try {
            let data = await lastValueFrom(await this.kubevirtMgrService.getNamespacedImages(imgNamespace));
            let images = data.items;
            for (let i = 0; i < images.length; i++) {

                imgSelectorOptions += "<option value=" + images[i].metadata["name"] +">" + images[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e.error.message);
        }
        return imgSelectorOptions;
    }

    /*
     * New VM: Reset Disk Forms
     */
    async resetDiskOptions(frmIndex: number) {
        let diskTypeField = document.getElementById("diskType-" + frmIndex.toString());
        let diskValueField = document.getElementById("diskValue-" + frmIndex.toString());
        
        /* Reset disk options */
        if(diskTypeField != null && diskValueField != null) {
            let diskOptions = "<option selected></option>\n<option value=blank>Blank Disk</option>\n<option value=image>Image</option>\n<option value=dv>DataVolume</option>";
            diskTypeField.innerHTML = diskOptions;
            diskValueField.innerHTML = "";
            diskValueField.setAttribute("disabled", "disabled");
        }
    }

    /*
     * New VM: Load Network Options
     */
    async loadNetworkOptions(frmIndex: number) {
        let namespaceField = document.getElementById("newvm-namespace");
        let netData = document.getElementById("newvm-netdata-tab");
        let networkSelectorOptions = "<option selected></option>\n<option value=podNetwork>podNetwork</option>\n";

        /* Set Networking options */
        if(this.networkCheck) {
            if(namespaceField != null && namespaceField instanceof HTMLSelectElement) {
                let namespace = namespaceField.value;
                let data = await lastValueFrom(this.k8sApisService.getNetworkAttachs());
                let netAttach = data.items;
                for (let i = 0; i < netAttach.length; i++) {
                    if(namespace == netAttach[i].metadata["namespace"]) {
                        let currentAttach = new NetworkAttach();
                        currentAttach.name = netAttach[i].metadata["name"];
                        currentAttach.namespace = netAttach[i].metadata["namespace"];
                        currentAttach.config = JSON.parse(netAttach[i].spec["config"]);
                        this.netAttachList.push(currentAttach);
                        networkSelectorOptions += "<option value=" + netAttach[i].metadata["namespace"] + "/" + netAttach[i].metadata["name"] + ">" + netAttach[i].metadata["name"] + "</option>\n";
                    }
                }
            }
        }

        let selectorNetworkField = document.getElementById("networkName-" + frmIndex.toString());
        if (selectorNetworkField != null && networkSelectorOptions != "") {
            selectorNetworkField.innerHTML = networkSelectorOptions;
        }
        if (netData != null && frmIndex == 0) {
            netData.setAttribute("style","display: none;");
        }
    }

    /*
     * New VM: Load Network/Disk/Auth Options
     */
    async onChangeNamespace(namespace: string) {
        let selectorAuthType = document.getElementById("newvm-userdata-auth");
        let selectorSSHKey = document.getElementById("newvm-userdata-ssh");
        
        /* Set Networking options */
        if(this.networkCheck) {
            let nicLength = this.nics.length;
            for(let nicIndex = 0; nicIndex < nicLength; nicIndex++) {
                await this.loadNetworkOptions(nicIndex);
            }
        }

        let diskLength = this.disks.length;
        for(let diskIndex = 0; diskIndex < diskLength; diskIndex++) {
            await this.resetDiskOptions(diskIndex);
        }

        /* Reset SSH Key Options */
        if(selectorAuthType != null && selectorSSHKey != null) {
            let authOptions = "<option value=password>User/Password</option>\n<option value=ssh>SSH Private Key</option>";
            selectorAuthType.innerHTML = "";
            selectorSSHKey.innerHTML = "";
            selectorAuthType.innerHTML = authOptions;
            this.onChangeAuthType("password", namespace);
        }
    }

    /*
     * New VM: Display Custom CPU/MEM
     */
    async onChangeType(vmType: string) {
        let modalDiv = document.getElementById("custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade show");
                modalDiv.setAttribute("aria-modal", "true");
                modalDiv.setAttribute("role", "dialog");
                modalDiv.setAttribute("aria-hidden", "false");
                modalDiv.setAttribute("style","display: contents;");
            }
        } else {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade");
                modalDiv.setAttribute("aria-modal", "false");
                modalDiv.setAttribute("role", "");
                modalDiv.setAttribute("aria-hidden", "true");
                modalDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * New VM: Change between pass/ssh auth
     */
    async onChangeAuthType(authType: string, namespace: string) {
        let modalSSHDiv = document.getElementById("newvm-userdata-ssh-panel");
        let modelPWDDiv = document.getElementById("newvm-userdata-password-panel");
        if(authType.toLowerCase() == "ssh") {
            let sshKeySelector = document.getElementById("newvm-userdata-ssh");
            if (sshKeySelector != null) {
                let data = await lastValueFrom(await this.k8sService.getSSHSecretsNamespaced(namespace));
                let keyList = data.items;
                let sshSelectorOptions = "";
                for(let i = 0; i < keyList.length; i++) {
                    sshSelectorOptions += "<option value=" + keyList[i].metadata["name"] + ">" + keyList[i].metadata["name"] + "</option>\n";
                }
                sshKeySelector.innerHTML = sshSelectorOptions;

            }
            if(modalSSHDiv != null && modelPWDDiv != null) {
                modalSSHDiv.setAttribute("class", "modal fade show");
                modalSSHDiv.setAttribute("aria-modal", "true");
                modalSSHDiv.setAttribute("role", "dialog");
                modalSSHDiv.setAttribute("aria-hidden", "false");
                modalSSHDiv.setAttribute("style","display: contents;");
                modelPWDDiv.setAttribute("class", "modal fade");
                modelPWDDiv.setAttribute("aria-modal", "false");
                modelPWDDiv.setAttribute("role", "");
                modelPWDDiv.setAttribute("aria-hidden", "true");
                modelPWDDiv.setAttribute("style","display: none;");
            }
        } else {
            if(modalSSHDiv != null && modelPWDDiv != null) {
                modelPWDDiv.setAttribute("class", "modal fade show");
                modelPWDDiv.setAttribute("aria-modal", "true");
                modelPWDDiv.setAttribute("role", "dialog");
                modelPWDDiv.setAttribute("aria-hidden", "false");
                modelPWDDiv.setAttribute("style","display: contents;");
                modalSSHDiv.setAttribute("class", "modal fade");
                modalSSHDiv.setAttribute("aria-modal", "false");
                modalSSHDiv.setAttribute("role", "");
                modalSSHDiv.setAttribute("aria-hidden", "true");
                modalSSHDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * New VM: Change network (hide/show metadata tab)
     */
    async onChangeNetwork(frmIndex: number) {
        let thisNetworkNameField = document.getElementById("networkName-" + frmIndex.toString());
        if (thisNetworkNameField != null && thisNetworkNameField instanceof HTMLSelectElement) {
            let thisNetwork = thisNetworkNameField.value;
            let netData = document.getElementById("newvm-netdata-tab");
            let selectorNetworkTypeField = document.getElementById("networkType-" + frmIndex.toString());
            let networkTypeSelectorOptions = "<option selected></option>\n<option value=bridge>bridge</option>\n";
            if(frmIndex == 0) {
                if(netData != null && thisNetwork.toLowerCase() != "podnetwork") {
                    networkTypeSelectorOptions += "<option value=macvtap>macvtap</option>\n";
                    netData.setAttribute("style","display: flex;");

                } else {
                    networkTypeSelectorOptions += "<option value=masquerade>masquerade</option>\n";
                    if(netData != null && thisNetwork.toLowerCase() == "podnetwork") {
                        netData.setAttribute("style","display: none;");
                    }
                }

                if(selectorNetworkTypeField != null) {
                    selectorNetworkTypeField.innerHTML = networkTypeSelectorOptions;
                }
            } else {
                if(netData != null && thisNetwork.toLowerCase() == "podnetwork") {
                    networkTypeSelectorOptions += "<option value=masquerade>masquerade</option>\n";
                } else {
                    networkTypeSelectorOptions += "<option value=macvtap>macvtap</option>\n";
                }

                if(selectorNetworkTypeField != null) {
                    selectorNetworkTypeField.innerHTML = networkTypeSelectorOptions;
                }
            }
        }
    }

    /*
     * Check VM Exists
     */
    checkVmExists(vmname: string, vmnamespace:string): boolean {
        for (let i = 0; i < this.vmList.length; i++) {
            if(this.vmList[i].name == vmname && this.vmList[i].namespace == vmnamespace) {
                return true;
            }
        }
        return false;
    }

    /*
     * Check Multus Support
     */
    async checkNetwork(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getCrds());
            let crds = data.items;
            for (let i = 0; i < crds.length; i++) {
                if(crds[i].metadata["name"] == "network-attachment-definitions.k8s.cni.cncf.io") {
                    this.networkCheck = true;
                }
            }
        } catch (e: any) {
            console.log(e.error.message);
        }
    }

    /*
     * Hide Component
     */
    hideComponent(divId: string): void {
        let modalDiv = document.getElementById(divId);
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade");
            modalDiv.setAttribute("aria-modal", "false");
            modalDiv.setAttribute("role", "");
            modalDiv.setAttribute("aria-hidden", "true");
            modalDiv.setAttribute("style","display: none;");
        }
    }

    /*
     * Open NoVNC
     */
    openNoVNC(namespace: string, name: string): void {
        let url = "/assets/noVNC/vnc.html?resize=scale&autoconnect=1&path=";
        let path = "/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/" + namespace + "/virtualmachineinstances/" + name + "/vnc";
        let fullpath = url + path;
        window.open(fullpath, "kubevirt-manager.io: CONSOLE", "width=800,height=600,location=no,toolbar=no,menubar=no,resizable=yes");
    }

    /*
     * Full Reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/vmlist`]);
        })
    }

    getBusOptions(diskKind: string): { value: string, label: string }[] {
      if (diskKind === 'disk') {
        return [
          { value: '', label: '' },
          { value: 'virtio', label: 'virtio' },
          { value: 'sata', label: 'sata' },
          { value: 'scsi', label: 'scsi' },
          { value: 'usb', label: 'usb' }
        ];
      } else {
        return [
          { value: '', label: '' },
          { value: 'virtio', label: 'virtio' },
          { value: 'sata', label: 'sata' },
          { value: 'scsi', label: 'scsi' }
        ];
      }
    }
}
