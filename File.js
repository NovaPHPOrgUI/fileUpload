/**
 * 文件上传工具类
 * 提供文件选择和上传功能，支持分段传输和直接传输两种模式
 * @file File.js
 * @author License Auto System
 * @version 2.0.0
 */

/**
 * 文件上传工具对象
 * 提供文件上传和选择功能
 * @namespace $.file
 */
$.file = {
    /**
     * 选择并上传文件
     * @param {Object} options 配置选项
     * @param {string} options.accept 接受的文件类型，默认为 '.xlsx'
     * @param {string} options.uploadEndpoint 上传接口地址，默认为 '/v1/upload'
     * @param {Object} options.uploadData 上传时的额外数据
     * @param {boolean} options.chunked 是否使用分段传输，默认为 true（推荐大文件使用）
     * @param {number} options.chunkSize 分块大小（字节），默认为 2MB，仅在 chunked=true 时有效
     * @param {number} options.maxDirectSize 直接传输的最大文件大小（字节），默认为 10MB，超过此大小强制使用分段传输
     * @param {Function} options.onSuccess 成功回调
     * @param {Function} options.onError 错误回调
     * @param {Function} options.onProgress 进度回调
     */
    upload: function(options = {}) {
        const defaultOptions = {
            accept: '.xlsx',
            uploadEndpoint: '/v1/upload',
            uploadData: {},
            chunked: true,
            chunkSize: 1024 * 1024 * 2, // 2MB
            maxDirectSize: 10 * 1024 * 1024, // 10MB
            onSuccess: null,
            onError: null,
            onProgress: null
        };
        
        const config = Object.assign({}, defaultOptions, options);
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = config.accept;
        fileInput.style.display = 'none';
        
        // 当选择文件后触发上传
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                // 根据文件大小决定传输方式
                const shouldUseChunked = config.chunked || file.size > config.maxDirectSize;
                
                if (shouldUseChunked) {
                    // 使用分段传输
                    this._uploadWithChunks(file, config);
                } else {
                    // 使用直接传输
                    this._uploadDirect(file, config);
                }
            }
        });

        // 触发文件选择对话框
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    },

    /**
     * 使用分段传输上传文件
     * @private
     */
    _uploadWithChunks: function(file, config) {
        let loading = new Loading(document.body);
        loading.setText("上传中");
        loading.show();

        let uploader = new FileUploader(file, {
            endpoint: config.uploadEndpoint,
            chunkSize: config.chunkSize,
            onProgress: function (currentChunk, totalChunks) {
                const progress = Math.round((currentChunk / totalChunks) * 100);
                loading.setProgress(progress);
                loading.setText("上传中（"+progress+"%）");
                if (config.onProgress) {
                    config.onProgress(progress);
                }
            },

            onComplete: function (result) {
                console.log('分段上传完成:', result);
                loading.close();
                if (result.code === 200) {
                    if (config.onSuccess) {
                        config.onSuccess(result);
                    }
                } else {
                    if (config.onError) {
                        config.onError(result.msg);
                    } else {
                        $.toaster.error(result.msg);
                    }
                }
            },
            onError: function (error) {
                loading.close();
                if (config.onError) {
                    config.onError(error);
                } else {
                    $.toaster.error(error);
                }
            }
        });

        // 设置额外的上传数据
        if (Object.keys(config.uploadData).length > 0) {
            // 存储额外数据到 uploader 实例
            uploader.extraData = config.uploadData;
            
            // 重写 uploadChunk 方法以支持额外数据
            const originalUploadChunk = uploader.uploadChunk.bind(uploader);
            uploader.uploadChunk = function(uniqueID) {
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
                
                // 添加额外的上传数据
                if (this.extraData) {
                    Object.keys(this.extraData).forEach(key => {
                        formData.append(key, this.extraData[key]);
                    });
                }

                this.ajax = new XMLHttpRequest();
                this.ajax.open('POST', this.endpoint, true);

                for (let key in this.headers) {
                    if (this.headers.hasOwnProperty(key)) {
                        this.ajax.setRequestHeader(key, this.headers[key]);
                    }
                }

                const self = this;
                this.ajax.upload.onprogress = (evt) => {
                    if (evt.lengthComputable) {
                        const chunkProgress = (evt.loaded / evt.total);
                        self.onProgress(self.currentChunk + chunkProgress, self.totalChunks);
                    }
                };

                this.ajax.onload = () => {
                    if (self.ajax.status >= 200 && self.ajax.status < 300) {
                        const result = JSON.parse(self.ajax.responseText);
                        if (result.code === 201 || result.code === 200) {
                            self.currentChunk++;
                            if (self.currentChunk < self.totalChunks) {
                                if (result.data !== null) {
                                    uniqueID = result.data;
                                }
                                self.uploadChunk(uniqueID);
                            } else {
                                self.onComplete(result);
                            }
                        } else {
                            self.onError(result.msg);
                        }
                    } else {
                        self.onError(self.ajax.statusText);
                    }
                };

                this.ajax.onerror = () => {
                    self.onError(self.ajax.statusText);
                };

                this.ajax.send(formData);
            }.bind(uploader);
        }

        uploader.upload();
    },

    /**
     * 使用直接传输上传文件
     * @private
     */
    _uploadDirect: function(file, config) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        formData.append('totalChunks', 1);
        formData.append('chunkIndex', 0);
        
        // 添加额外的上传数据
        Object.keys(config.uploadData).forEach(key => {
            formData.append(key, config.uploadData[key]);
        });

        let loading = new Loading(document.body);
        loading.setText("上传中");
        loading.show();

        const xhr = new XMLHttpRequest();
        
        // 上传进度
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100);
                loading.setProgress(progress);
                if (config.onProgress) {
                    config.onProgress(progress);
                }
            }
        };

        // 上传完成
        xhr.onload = function() {
            loading.close();
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    console.log('直接上传完成:', result);
                    if (result.code === 200) {
                        if (config.onSuccess) {
                            config.onSuccess(result);
                        }
                    } else {
                        if (config.onError) {
                            config.onError(result.msg);
                        } else {
                            $.toaster.error(result.msg);
                        }
                    }
                } catch (e) {
                    if (config.onError) {
                        config.onError('响应解析失败');
                    } else {
                        $.toaster.error('响应解析失败');
                    }
                }
            } else {
                if (config.onError) {
                    config.onError('上传失败: ' + xhr.statusText);
                } else {
                    $.toaster.error('上传失败: ' + xhr.statusText);
                }
            }
        };

        // 上传错误
        xhr.onerror = function() {
            loading.close();
            if (config.onError) {
                config.onError('网络错误');
            } else {
                $.toaster.error('网络错误');
            }
        };

        xhr.open('POST', config.uploadEndpoint, true);
        xhr.send(formData);
    },
    
    /**
     * 选择文件（仅选择，不上传）
     * @param {Object} options 配置选项
     * @param {string} options.accept 接受的文件类型，默认为 '.xlsx'
     * @param {Function} options.onSelect 文件选择回调
     */
    select: function(options = {}) {
        const defaultOptions = {
            accept: '.xlsx',
            onSelect: null
        };
        
        const config = Object.assign({}, defaultOptions, options);
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = config.accept;
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && config.onSelect) {
                config.onSelect(file);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }
};

/**
 * 使用示例：
 * 
 * // 分段传输（推荐大文件）
 * $.file.upload({
 *     accept: '.xlsx,.xls',
 *     uploadEndpoint: '/v1/racePlayer/import',
 *     uploadData: {raceId: row.id},
 *     chunked: true,
 *     chunkSize: 2 * 1024 * 1024, // 2MB 每块
 *     onSuccess: function(response) {
 *         database.reload({raceId: row.id});
 *         initTotalSize();
 *         $.toaster.success(response.msg);
 *     },
 *     onError: function(error) {
 *         $.toaster.error(error);
 *     },
 *     onProgress: function(progress) {
 *         console.log('上传进度:', progress + '%');
 *     }
 * });
 * 
 * // 直接传输（小文件）
 * $.file.upload({
 *     accept: '.jpg,.png',
 *     uploadEndpoint: '/v1/image/upload',
 *     chunked: false,
 *     onSuccess: function(response) {
 *         $.toaster.success('图片上传成功');
 *     }
 * });
 * 
 * // 自动选择传输方式（根据文件大小）
 * $.file.upload({
 *     accept: '*',
 *     uploadEndpoint: '/v1/file/upload',
 *     maxDirectSize: 5 * 1024 * 1024, // 5MB 以下直接传输
 *     onSuccess: function(response) {
 *         $.toaster.success('文件上传成功');
 *     }
 * });
 */