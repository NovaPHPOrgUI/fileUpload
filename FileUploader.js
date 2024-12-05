class FileUploader {
    constructor(file, options) {
        this.file = file;
        this.chunkSize = options.chunkSize || 2 * 1024 * 1024; // Default to 2MB per chunk
        this.endpoint = options.endpoint || '/upload.php';
        this.onProgress = options.onProgress || function () {
            console.info("Uploading...", arguments);
        };
        this.onComplete = options.onComplete || function () { };
        this.onError = options.onError || function () { };
        this.uploadId = options.uploadId || this.generateUploadId();
        this.currentChunk = 0;
        this.ajax = null;
        this.headers = {};
    }

    generateUploadId() {
        return Math.random().toString(36).substring(2, 16);
    }

    upload() {
        this.totalChunks = Math.ceil(this.file.size / this.chunkSize);

        if (!this.file.type || this.file.type.indexOf("image") === -1) {
            this.uploadChunk("");
            return;
        }
        let that = this;
        $.loader("/components/fileUpload/image-compressor.js", () => {
            const options = {
                file: that.file,
                convertSize: 1024 * 512, // 512KB
                quality: 0.6, // 80%
                maxWidth: 1024,
                // Before compression callback
                beforeCompress: function (result) {
                    console.info("Original image size: ", result.size);
                    console.info("MIME type: ", result.type);
                },

                // Success callback
                success: function (result) {
                    console.info("Compressed image size: ", result.size);
                    console.info("MIME type: ", result.type);
                    console.info(
                        "Compression ratio: ",
                        (
                            ((that.file.size - result.size) / that.file.size) *
                            100
                        ).toFixed(2) + "%",
                    );
                    that.file = result;
                    that.totalChunks = Math.ceil(result.size / that.chunkSize);
                    that.uploadChunk("");
                },
            };

            new ImageCompressor(options);
        });
    }

    abort() {
        if (this.ajax) {
            this.ajax.abort();
        }
    }
    setHeaders(headers) {
        this.headers = headers;
        return this;
    }


    remove(name) {
        this.ajax = new XMLHttpRequest();
        this.ajax.open('DELETE', `${this.endpoint}/${encodeURIComponent(name)}`, true);
        for (let key in  this.headers) {
            if ( this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key,  this.headers[key]);
            }
        }
        this.ajax.send();
    }

    load(name) {
        this.ajax = new XMLHttpRequest();
        this.ajax.open('GET', `${this.endpoint}/${encodeURIComponent(name)}`, true);

        for (let key in  this.headers) {
            if ( this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key,  this.headers[key]);
            }
        }
        this.ajax.responseType = "blob";
        this.ajax.onload = () => {
            if (this.ajax.status >= 200 && this.ajax.status < 300) {
                const blob = this.ajax.response;
                const file = new File([blob], name, { type: blob.type });
                this.onComplete(file);
            } else {
                this.onError(this.ajax.statusText);
                console.error("Load failed");
            }
        };

        this.ajax.onerror = () => {
            this.onError(this.ajax.statusText);
            console.error("Load failed");
        };

        this.ajax.send();
    }

    uploadChunk(uniqueID) {
        const start = this.currentChunk * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        const chunk = this.file.slice(start, end);
        const formData = new FormData();

        formData.append('file', chunk);
        formData.append('uploadId', this.uploadId);
        formData.append('chunkIndex', this.currentChunk);
        formData.append('totalChunks', this.totalChunks);
        formData.append('fileName', this.file.name);
        formData.append("unique", uniqueID);

        this.ajax = new XMLHttpRequest();
        this.ajax.open('POST', this.endpoint, true);

        for (let key in  this.headers) {
            if ( this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key,  this.headers[key]);
            }
        }

        this.ajax.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                const chunkProgress = (evt.loaded / evt.total);
                this.onProgress(this.currentChunk + chunkProgress, this.totalChunks);
            }
        };

        this.ajax.onload = () => {
            if (this.ajax.status >= 200 && this.ajax.status < 300) {
                const result = JSON.parse(this.ajax.responseText);
                if (result.code === 201 || result.code === 200) {
                    this.currentChunk++;
                    if (this.currentChunk < this.totalChunks) {
                        if (result.data !== null) {
                            uniqueID = result.data;
                        }
                        this.uploadChunk(uniqueID);
                    } else {
                        this.onComplete(result);
                    }
                } else {
                    this.onError(result.msg);
                }
            } else {
                this.onError(this.ajax.statusText);
                console.error("Upload failed");
            }
        };

        this.ajax.onerror = () => {
            this.onError(this.ajax.statusText);
            console.error("Upload failed");
        };

        this.ajax.send(formData);
    }


}
