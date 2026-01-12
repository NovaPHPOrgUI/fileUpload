/*
 * Copyright (c) 2025. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 * Morbi non lorem porttitor neque feugiat blandit. Ut vitae ipsum eget quam lacinia accumsan.
 * Etiam sed turpis ac ipsum condimentum fringilla. Maecenas magna.
 * Proin dapibus sapien vel ante. Aliquam erat volutpat. Pellentesque sagittis ligula eget metus.
 * Vestibulum commodo. Ut rhoncus gravida arcu.
 */

class FileUpload extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<input type="file"  />`;
    // 初始化自定义的 validity 对象
    this._validity = {
      valueMissing: false,
      customError: false,
      valid: false,
    };
  }
  // 自定义 validity 对象的 getter
  get validity() {
    return this._validity;
  }


  reportValidity() {
    $.toaster.error("请上传文件或者等待文件上传完成");
    let filepond = this.shadowRoot.querySelector(".filepond--drop-label");
    filepond.classList.add("filepond--error");

  }


  get value() {
    if (typeof this._value === "string") {
      return this._value;
    }
    return [...new Set(this._value)];
  }

    set value(val) {

      $.waitProp(this, "pond", () => {
        this.setFiles(val);
      });

    }

  // 验证方法
  validate() {
    let filepond = this.shadowRoot.querySelector(".filepond--drop-label");
    filepond.classList.remove("filepond--error");
    this._validity.valueMissing = false;
    if (this.hasAttribute("required")) {
      if (this.pond.status !== 4 && this.pond.status !== 1) {
        this._validity.valueMissing = true;
      }
      if (this._value.length === 0) {
        this._validity.valueMissing = true;
      }
    }

    if (this.pond.status === 3) {
      this._validity.valueMissing = true;
    }

    // 更新 valid 属性
    this._validity.valid = !this._validity.valueMissing ;


    // console.log(this._validity.valid, this._value.length === 0)

  }

  /**
   * 设置额外的 FormData 参数
   * @param {string} key - 参数名
   * @param {string|number} value - 参数值
   */
  setExtraParam(key, value) {
    if (!this.config.extraParams) {
      this.config.extraParams = {};
    }
    this.config.extraParams[key] = value;
  }

  /**
   * 移除额外的 FormData 参数
   * @param {string} key - 参数名
   */
  removeExtraParam(key) {
    if (this.config.extraParams) {
      delete this.config.extraParams[key];
    }
  }

  /**
   * 获取额外的 FormData 参数
   * @param {string} key - 参数名
   * @returns {string|number|undefined} 参数值
   */
  getExtraParam(key) {
    return this.config.extraParams?.[key];
  }

  /**
   * 动态获取额外的 FormData 数据
   * 只返回通过 setExtraParam() 手动设置的参数
   */
  getExtraData() {
    return this.config.extraParams ? { ...this.config.extraParams } : {};
  }

  connectedCallback() {
    this.config = {
      uri: this.getAttribute("uri") || "/upload",
      allowMultiple: this.getAttribute("multiple") === "true",
      name: this.getAttribute("name") || "file",
      files: [], // [{uri: "http://xxx.com/xxx.jpg", name: "xxx.jpg", size: 1024, type: "image/jpeg"}]
      maxFiles: this.getAttribute("limit") || 1,
      // 支持换行/空格分隔的 accept，过滤空串
      accept: (() => {
        const raw = this.getAttribute("accept");
        const list = (raw ? raw : "image/*")
          .split(",")
          .map(item => item.trim())
          .filter(Boolean);
        return list.length ? list : ["image/*"];
      })(),
      extraParams: {}, // 手动设置的额外参数
    };
    this.init();
  }

  initComponent() {
    FilePond.registerPlugin(FilePondPluginImagePreview);
    FilePond.registerPlugin(FilePondPluginFileValidateType);
//    FilePond.registerPlugin(FilePondPluginGPXAdvanced);
    this.config.files = [];
    this.initFilePond();
  }

  init() {
    loader.load(
      [
        "/components/fileUpload/filepond.css",
        "/components/fileUpload/filepond-plugin-file-validate-type.js",
        "/components/fileUpload/filepond-plugin-image-preview.css",
        "/components/fileUpload/filepond-plugin-image-preview.js",
        "/components/fileUpload/filepond.js",
        "/components/fileUpload/image-compressor.js",
        "/components/fileUpload/FileUploader.js",
      ],
        () => {
          this.initComponent();

        },
      this.shadowRoot,
    );

  }

  addFileValue(val) {
    if(this.config.allowMultiple){
      if(this._value) {
        this._value.push(val);
      }else {
        this._value = [val];
      }
    }else {
      this._value = val;
    }
    this.validate();
  }

  setFiles(files) {
    this.config.files = [];
    files =  files.length > 0 ? files : [];
    //判断files是否为String
    if (typeof files === "string") {
      files = [files];
    }
    files.forEach((file) => {
      this.config.files.push({
        source: file,
        options: {
          type: "local",
        },
      });
    });
    if (this.config.allowMultiple) {
      this._value = files;
    } else {
      this._value = files.length > 0 ? files[0] : "";
    }
    if (!this.pond) return
    this.pond.setOptions({
      files: this.config.files,
    });
    this.validate();
  }
  removeFileValue(val) {
    if(this.config.allowMultiple){
      this._value = this._value.filter((item) => item !== val);
    }else {
      this._value = "";
    }
    this.validate();
  }

  initFilePond() {
    const inputElement = this.shadowRoot.querySelector("input");
    let that = this;
    let config = {
      name: this.config.name,
      allowMultiple: this.config.allowMultiple,
      maxFiles: this.config.maxFiles,
      files: this.config.files,
      credits: false,
      server: {
        process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {

          that._value = [];
          const extraData = that.getExtraData();
          const uploader = new FileUploader(file, {
            chunkSize: 2 * 1024 * 1024, // 2MB per chunk
            endpoint: that.config.uri,
            extraData: extraData,
            onProgress: (current, total) => {

              progress(true, current, total);
            },
            onComplete: (result) => {
              load(result.data);
              that.addFileValue(result.data);
              $.emitter.emit("fileUpload",result.data);
            },
            onError: (error) => {
                console.error('Upload failed', error, arguments);
            }
          });

          uploader.upload();


          return {
            abort: () => {
              // This function is entered if the user has tapped the cancel button
              uploader.abort();

              // Let FilePond know the request has been cancelled
              abort();
            },
          };
        },
        load: (source, load, error, progress, abort, headers) => {
          const uploader = new FileUploader(null, {
            chunkSize: 2 * 1024 * 1024, // 2MB per chunk
            endpoint: that.config.uri,

            onComplete: (result) => {
              load(result);
              that.addFileValue(source);
            },
            onError: (error) => {
              console.error('Upload failed', error);
            }
          });

          uploader.load(source);


          // Should expose an abort method so the request can be cancelled
          return {
            abort: () => {
              // User tapped cancel, abort our ongoing actions here
              uploader.abort();
              // Let FilePond know the request has been cancelled
              abort();
            },
          };
        },
        revert: (source, load, error) => {
          // Should somehow send `source` to server so server can remove the file with this source

          const uploader = new FileUploader(null, {
            chunkSize: 2 * 1024 * 1024, // 2MB per chunk
            endpoint: that.config.uri,

          });

          that.removeFileValue(source)
          uploader.remove(source);
          // Should call the load method when done, no parameters required
          load();
        },
          remove: (source, load, error) => {
              // Should somehow send `source` to server so server can remove the file with this source
              const uploader = new FileUploader(null, {
                  chunkSize: 2 * 1024 * 1024, // 2MB per chunk
                  endpoint: that.config.uri,

              });
              that.removeFileValue(source)
              uploader.remove(source);

              // Should call the load method when done, no parameters required
              load();
          },
      },
      //文件类型
      acceptedFileTypes: this.config.accept,

      // 用于上传按钮的标签。
      fileValidateTypeDetectType: (source, type) =>
        new Promise((resolve, reject) => {
          $.logger.debug("select file "+ type,source)
          if (!type) {
            let name = source.name;
            const match = name.match(/(\.[^.]+)$/);
            type = match ? match[1] : type;
          }

          resolve(type);
        }),
    };
    this.pond = FilePond.create(inputElement, config);
    this.setFiles(this.config.files);
    $.emitter.on("translate:set", () => {
      that.setTranslate();
    });
    that.setTranslate();
  }

  setTranslate() {
    let obj = {
      labelFileTypeNotAllowed: "该文件类型不允许上传",
      fileValidateTypeLabelExpectedTypes: "应当选择 {allTypes}",
      labelIdle:
        '拖放文件或 <span class="filepond--label-action"> 浏览 </span>',
      // 显示的默认标签表明这是一个放置区域。FilePond 将自动将浏览文件事件绑定到 CSS 类 .filepond--label-action 的元素。

      labelInvalidField: "字段包含无效的文件",
      // 当字段包含无效文件并由父表单验证时显示的标签。

      labelFileWaitingForSize: "等待文件大小信息",
      // 等待文件大小信息时使用的标签。

      labelFileSizeNotAvailable: "文件大小不可用",
      // 未收到文件大小信息时使用的标签。

      labelFileLoading: "加载中",
      // 加载文件时使用的标签。

      labelFileLoadError: "加载时出错",
      // 文件加载失败时���用的标签。

      labelFileProcessing: "上传中",
      // 上传文件时使用的标签。

      labelFileProcessingComplete: "上传完成",
      // 文件上传完成时使用的标签。

      labelFileProcessingAborted: "上传已取消",
      // 取消上传时使用的标签。

      labelFileProcessingError: "上传过程中出错",
      // 文件上传过程中出现问题时使用的标签。

      labelFileProcessingRevertError: "恢复时出错",
      // 恢复文件上传过程中出现问题时使用的标签。

      labelFileRemoveError: "删除时出错",
      // 删除文件时出现问题的标签。

      labelTapToCancel: "点击取消",
      // 用于向用户指示可以取消操作的标签。

      labelTapToRetry: "点击重试",
      // 用于向用户指示可以重试操作的标签。

      labelTapToUndo: "点击撤销",
      // 用于向用户指示可以撤消操作的标签。

      labelButtonRemoveItem: "删除",
      // 用于删除按钮的标签。

      labelButtonAbortItemLoad: "中止",
      // 用于中止加载按钮的标签。

      labelButtonRetryItemLoad: "重试",
      // 用于重试加载按钮的标签。

      labelButtonAbortItemProcessing: "取消",
      // 用于中止上传按钮�����签。

      labelButtonUndoItemProcessing: "撤销",
      // 用于撤消上传按钮的标签。

      labelButtonRetryItemProcessing: "重试",
      // 用于重试上传按钮的标签。

      labelButtonProcessItem: "上传",
    };
    let translates = [];
    let that = this;

    for (let key in obj) {
      translates.push(obj[key]);
    }
    if ($.translate instanceof Function) {
      $.translate(translates, (data) => {
        let keys = Object.keys(obj);
        data.forEach((res, index) => {
          obj[keys[index]] = res;
        });
        that.pond.setOptions(obj);
      });
    }else {
      that.pond.setOptions(obj);
    }

  }
  destroy() {
    this.pond.destroy();
  }
}

customElements.define("mdui-file-upload", FileUpload);
