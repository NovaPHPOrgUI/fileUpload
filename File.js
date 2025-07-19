/**
 * 文件上传工具类
 * 提供文件选择和上传功能，支持进度回调和错误处理
 * @file File.js
 * @author License Auto System
 * @version 1.0.0
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
     * @param {Function} options.onSuccess 成功回调
     * @param {Function} options.onError 错误回调
     * @param {Function} options.onProgress 进度回调
     */
    upload: function(options = {}) {
        const defaultOptions = {
            accept: '.xlsx',
            uploadEndpoint: '/v1/upload',
            uploadData: {},
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
                const formData = new FormData();
                formData.append('file', file);
                
                // 添加额外的上传数据
                Object.keys(config.uploadData).forEach(key => {
                    formData.append(key, config.uploadData[key]);
                });
                
                let loading = new Loading(document.body);
                loading.setText("上传中");

                loading.show();
                let uploader = new FileUploader(file, {
                    endpoint: config.uploadEndpoint,
                    onProgress: function (progress) {
                        loading.setProgress(progress);
                        if (config.onProgress) {
                            config.onProgress(progress);
                        }
                    },
                    onComplete: function (result) {
                        console.log(result);
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
                uploader.upload();
            }
        });

        // 触发文件选择对话框
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
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
 * $.file.upload({
 *     accept: '.xlsx,.xls',
 *     uploadEndpoint: '/v1/racePlayer/import',
 *     uploadData: {raceId: row.id},
 *     onSuccess: function(response) {
 *         database.reload({raceId: row.id});
 *         initTotalSize();
 *         $.toaster.success(response.msg);
 *     },
 *     onError: function(error) {
 *         $.toaster.error(error);
 *     }
 * });
 */