/*
 * Copyright (c) 2025. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 * Morbi non lorem porttitor neque feugiat blandit. Ut vitae ipsum eget quam lacinia accumsan.
 * Etiam sed turpis ac ipsum condimentum fringilla. Maecenas magna.
 * Proin dapibus sapien vel ante. Aliquam erat volutpat. Pellentesque sagittis ligula eget metus.
 * Vestibulum commodo. Ut rhoncus gravida arcu.
 */

/**
 * 文件上传器类
 * 支持分块上传大文件，支持图片压缩，支持断点续传
 * 
 * @class FileUploader
 * @description 一个功能完整的文件上传组件，支持大文件分块上传、图片压缩、断点续传等功能
 */
class FileUploader {
    /**
     * 构造函数
     * 
     * @param {File} file - 要上传的文件对象
     * @param {Object} options - 配置选项
     * @param {number} [options.chunkSize=2097152] - 每个分块的大小（字节），默认2MB
     * @param {string} [options.endpoint='/upload.php'] - 上传接口地址
     * @param {Function} [options.onProgress] - 上传进度回调函数
     * @param {Function} [options.onComplete] - 上传完成回调函数
     * @param {Function} [options.onError] - 上传错误回调函数
     * @param {string} [options.uploadId] - 上传ID，如果不提供则自动生成
     */
    constructor(file, options) {
        this.file = file;
        this.chunkSize = options.chunkSize || 2 * 1024 * 1024; // 默认2MB每块
        this.endpoint = options.endpoint || '/upload.php';
        this.onProgress = options.onProgress || function () {
            console.info("Uploading...", arguments);
        };
        this.onComplete = options.onComplete || function () { };
        this.onError = options.onError || function () { };
        this.uploadId = options.uploadId || this.generateUploadId();
        this.currentChunk = 0; // 当前分块索引
        this.ajax = null; // XMLHttpRequest对象
        this.headers = {}; // 请求头
    }

    /**
     * 生成唯一的上传ID
     * 
     * @returns {string} 随机生成的上传ID
     */
    generateUploadId() {
        return Math.random().toString(36).substring(2, 16);
    }

    /**
     * 开始上传文件
     * 如果是图片文件，会先进行压缩处理
     */
    upload() {
        this.totalChunks = Math.ceil(this.file.size / this.chunkSize);

        // 如果不是图片文件，直接开始上传
        if (!this.file.type || this.file.type.indexOf("image") === -1) {
            this.uploadChunk("");
            return;
        }
        
        // 如果是图片文件，先进行压缩
        let that = this;
        $.loader("/components/fileUpload/image-compressor.js", () => {
            const options = {
                file: that.file,
                convertSize: 1024 * 512, // 512KB
                quality: 0.6, // 压缩质量60%
                maxWidth: 1024, // 最大宽度1024px
                // 压缩前回调
                beforeCompress: function (result) {
                    console.info("Original image size: ", result.size);
                    console.info("MIME type: ", result.type);
                },

                // 压缩成功回调
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

    /**
     * 中止上传
     * 取消当前正在进行的上传请求
     */
    abort() {
        if (this.ajax) {
            this.ajax.abort();
        }
    }

    /**
     * 设置请求头
     * 
     * @param {Object} headers - 请求头对象
     * @returns {FileUploader} 返回this以支持链式调用
     */
    setHeaders(headers) {
        this.headers = headers;
        return this;
    }

    /**
     * 删除服务器上的文件
     * 
     * @param {string} name - 要删除的文件名
     */
    remove(name) {
        this.ajax = new XMLHttpRequest();
        this.ajax.open('DELETE', `${this.endpoint}/${encodeURIComponent(name)}`, true);
        
        // 设置请求头
        for (let key in this.headers) {
            if (this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key, this.headers[key]);
            }
        }
        this.ajax.send();
    }

    /**
     * 从服务器加载文件
     * 
     * @param {string} name - 要加载的文件名
     */
    load(name) {
        this.ajax = new XMLHttpRequest();
        this.ajax.open('GET', `${this.endpoint}/${encodeURIComponent(name)}`, true);

        // 设置请求头
        for (let key in this.headers) {
            if (this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key, this.headers[key]);
            }
        }
        
        this.ajax.responseType = "blob";
        
        // 加载成功回调
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

        // 加载失败回调
        this.ajax.onerror = () => {
            this.onError(this.ajax.statusText);
            console.error("Load failed");
        };

        this.ajax.send();
    }

    /**
     * 上传单个分块
     * 
     * @param {string} uniqueID - 唯一标识符，用于断点续传
     */
    uploadChunk(uniqueID) {
        // 计算当前分块的起始和结束位置
        const start = this.currentChunk * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        const chunk = this.file.slice(start, end);
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('uploadId', this.uploadId);
        formData.append('chunkIndex', this.currentChunk);
        formData.append('totalChunks', this.totalChunks);
        formData.append('fileName', this.file.name);
        formData.append("unique", uniqueID);

        // 创建XMLHttpRequest对象
        this.ajax = new XMLHttpRequest();
        this.ajax.open('POST', this.endpoint, true);

        // 设置请求头
        for (let key in this.headers) {
            if (this.headers.hasOwnProperty(key)) {
                this.ajax.setRequestHeader(key, this.headers[key]);
            }
        }

        // 上传进度监听
        this.ajax.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                const chunkProgress = (evt.loaded / evt.total);
                this.onProgress(this.currentChunk + chunkProgress, this.totalChunks);
            }
        };

        // 上传完成回调
        this.ajax.onload = () => {
            if (this.ajax.status >= 200 && this.ajax.status < 300) {
                const result = JSON.parse(this.ajax.responseText);
                if (result.code === 201 || result.code === 200) {
                    this.currentChunk++;
                    if (this.currentChunk < this.totalChunks) {
                        // 还有更多分块需要上传
                        if (result.data !== null) {
                            uniqueID = result.data;
                        }
                        this.uploadChunk(uniqueID);
                    } else {
                        // 所有分块上传完成
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

        // 上传失败回调
        this.ajax.onerror = () => {
            this.onError(this.ajax.statusText);
            console.error("Upload failed");
        };

        this.ajax.send(formData);
    }
}
