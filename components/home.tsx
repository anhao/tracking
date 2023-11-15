'use client'
import {Button, Form, Input, Modal, Space, Table, TabPane, Tabs, TextArea, Toast} from '@douyinfe/semi-ui';
import {IconEyeOpened, IconSetting} from "@douyinfe/semi-icons";
import {useEffect, useState} from "react";
import {Timeline} from '@douyinfe/semi-ui';
import {Typography} from '@douyinfe/semi-ui';
import {notification, shell} from '@tauri-apps/api';

const {Text} = Typography
const API_URL = "https://v2.alapi.cn/api/tracking"
//0查询异常 1暂无记录 2在途中 3派送中 4已签收 5拒收 6疑难件 7无效单 8超时单 9签收失败 10退回签收
const TRACK_STATUS = [
    '查询异常',
    '暂无记录',
    "在途中",
    "派送中",
    "已签收",
    '拒收',
    '疑难件',
    '无效单',
    '超时单',
    '签收失败',
    '退回签收'
]

interface columnItem {
    exp_name: string
    name: string
    status: string
    msg: string
    time: string
    info: {
        time: string
        content: string
    }[],
    number: string,
    content: string
}

async function openUrl(url:string) {
   await shell.open(url)
}

export const HomePanel = () => {
    const [settingVisible, setSettingVisible] = useState(false)
    const [batchVisible, setBatchVisible] = useState(false)
    const [dataSource, setDataSource] = useState<columnItem[]>([])
    const [numbers, setNumbers] = useState<string[]>([])
    const [token, setToken] = useState(
        localStorage.getItem("tracking_token") || ""
    )
    const [trackResult, setTrackResult] = useState({})

    const [batch, setBatch] = useState("")

    const [timelineVisible, setTimelineVisible] = useState(false)
    const [current, setCurrent] = useState<columnItem>()

    const [isQuery, setIsQuery] = useState(false)

    // @ts-ignore
    const columns:ColumnProps<columnItem> = [
        {
            title: '快递公司',
            dataIndex: 'exp_name',
            fixed: true,
            align: 'center',
        },
        {
            title: "快递编号",
            dataIndex: "number",
            // width: "160px",
            align: 'center',
            fixed: true,
        },
        {
            title: "提示消息",
            dataIndex: "msg",
            align: 'center',
        },
        {
            title: "物流状态",
            dataIndex: "status",
            // width: "120px",
            align: 'center',
            render: (text: any, record: columnItem) => {
                return TRACK_STATUS[text] || ''
            },
            filters: [
                ////0查询异常 1暂无记录 2在途中 3派送中 4已签收 5拒收 6疑难件 7无效单 8超时单 9签收失败 10退回签收
                {
                    text: '查询异常',
                    value: 0,
                },
                {
                    text: '暂无记录',
                    value: 1,
                },
                {
                    text: "在途中",
                    value: 2
                },
                {
                    text: "派送中",
                    value: 3
                },
                {
                    text: "已签收",
                    value: 4
                },
                {
                    text: "拒收",
                    value: 5,
                },
                {
                    text: "疑难件",
                    value: 6
                },
                {
                    text: "无效单",
                    value: 7
                }, {
                    text: "超时单",
                    value: 8
                },
                {
                    text: "签收失败",
                    value: 9
                },
                {
                    text: "退回签收",
                    value: 10
                }
            ],
            onFilter: (value: any, record: columnItem) => String(record.status).includes(value),
        }, {
            title: "最后轨迹时间",
            dataIndex: "time",
            // width: "180px",
            align: 'center',
            //@ts-ignore
            sorter: (a: columnItem, b: columnItem) => (a.time - b.time > 0 ? 1 : -1),
        }, {
            title: "最后轨迹",
            dataIndex: "content",
            // width: "180px",
            align: 'center',
            render: (text: any) => {
                return <Text style={{width: "100px"}} ellipsis={{showTooltip: true}}>{text}</Text>
            }
        },
        {
            title: '物流轨迹',
            dataIndex: 'operate',
            render: (text: any, record: columnItem) => (
                <Button onClick={() => {
                    setCurrent(record);
                    setTimelineVisible(true)
                }}><IconEyeOpened/></Button>
            ),
            align: 'center',
        },
    ];

    const handleQuery = (values: { number: string }) => {
        if (!values.number) {
            Toast.error("请输入快递单号")
            return
        }
        if (!token) {
            Toast.error("请设置 token")
            setSettingVisible(true)
            return
        }
        if (numbers.indexOf(values.number) === -1) {
            setNumbers(prevNumbers => [...prevNumbers, values.number]);
        }
    }
    useEffect(() => {
        if (numbers.length > 0) {
            queryTrack(numbers).then(res => {
                //查询完成后清空 numbers
                setNumbers([])
            })
        }
    }, [numbers])

    async function concurrentRequests(urlArray: string[], maxRequests: number) {
        const results: any[] = []; // 存储每个请求的结果
        let currentIndex = 0;

        // 辅助函数，用于发送单个请求
        async function sendRequest(url: string) {
            const response = await fetch(url);
            return await response.json();
        }

        // 辅助函数，递归执行请求
        async function executeRequests() {
            while (currentIndex < urlArray.length) {
                const currentUrl = urlArray[currentIndex];
                currentIndex++;

                const resultPromise = sendRequest(currentUrl);
                results.push(resultPromise);

                // 如果当前请求数超过最大请求数，等待最早完成的请求
                if (currentIndex >= maxRequests) {
                    await Promise.race(results);
                }
            }

            // 等待所有请求完成
            return Promise.all(results);
        }

        return executeRequests();
    }

    const queryTrack = async (numbers: string[]) => {
        const urls = []
        for (const number of numbers) {
            //@ts-ignore
            let tempNumber = number
            let phone = ""
            if (number.includes(":")) {
                tempNumber = number.split(":")[0]
                phone = number.split(":")[1]
            }
            urls.push(`${API_URL}?token=${token}&number=${tempNumber}&phone=${phone}`)
        }
        setIsQuery(true)
        const results = await concurrentRequests(urls, 10)
        for (const result of results) {
            if (result.code === 200) {
                const data: columnItem = result.data
                if (data.info.length >= 1) {
                    data.time = data.info[0].time
                    data.content = data.info[0].content
                } else {
                    data.time = ""
                    data.content = ""
                }
                setDataSource(prevDataSource => [...prevDataSource, data])
            } else {
                //@ts-ignore
                const data: columnItem = {msg: result.msg, info: []}
                setDataSource(prevDataSource => [...prevDataSource, data])
            }
        }
        setIsQuery(false)
        return results
    }

    const handlerBatchQuery = () => {
        const texts = batch.split("\n")
        if (!texts.length) {
            Toast.error('请输入快递单号')
            return
        }
        if (!token) {
            Toast.error("请设置 token")
            setSettingVisible(true)
            return
        }
        setNumbers(prevNumbers => [...prevNumbers, ...texts]);
        setBatchVisible(false)
    };
    return <>
        <Tabs type="button">
            <TabPane tab="快递查询" itemKey="tracking">
                <div>
                    <div>
                        <Form labelPosition='inset' layout="horizontal" autoComplete={'off'}
                              onSubmit={(values, e) => handleQuery(values)}>
                            <Space>
                                <Form.Input label={'快递单号'} placeholder={"请输入快递单号查询"} field="number"
                                            style={{width: "100%"}}
                                            minLength={4}/>
                                <Button type="primary" htmlType="submit" onClick={() => handleQuery}
                                        disabled={isQuery}>{isQuery ? '查询中' : '查询'}</Button>
                                <Button type='primary' htmlType={'button'}
                                        onClick={() => setBatchVisible(true)}
                                        disabled={isQuery}>{isQuery ? '查询中' : '批量查询'}</Button>
                                <Button icon={<IconSetting/>} aria-label="设置"
                                        onClick={() => setSettingVisible(true)}/>
                            </Space>
                        </Form>
                    </div>
                    <div style={{marginTop: '10px'}}>
                        <Table loading={isQuery} scroll={{y: 600}} bordered dataSource={dataSource} columns={columns}
                               pagination={false}/>
                    </div>
                </div>
            </TabPane>
            <TabPane tab="关于" itemKey="about">
                <Text>快递查询工具 基于  <Text link underline onClick={()=>openUrl("https://www.alapi.cn")}>ALAPI</Text>  提供的接口开发而成</Text>
                <br/>
                <Text>获取秘钥地址：<Text link underline onClick={()=>openUrl('https://admin.alapi.cn')} >https://admin.alapi.cn</Text></Text>
            </TabPane>
        </Tabs>
        <Modal title='秘钥设置' visible={settingVisible} onCancel={() => setSettingVisible(false)} onOk={() => {
            localStorage.setItem("tracking_token", token)
            setSettingVisible(false)
        }}>
            <Input placeholder="请输入秘钥" onChange={e => setToken(e)} value={token}/>
            <br/>
            <Text>获取秘钥地址：<Text link underline onClick={()=>openUrl('https://admin.alapi.cn')} >https://admin.alapi.cn</Text></Text>
        </Modal>
        <Modal title={"批量查询"} visible={batchVisible} onCancel={() => setBatchVisible(false)}
               onOk={() => handlerBatchQuery()}>
            <TextArea value={batch} onChange={e => setBatch(e)} placeholder={'请传入快递号，一行一个'}/>
        </Modal>
        <Modal centered height={500} title={"轨迹详情"} visible={timelineVisible}
               onCancel={() => setTimelineVisible(false)}
               onOk={() => setTimelineVisible(false)}>
            <Timeline style={{overflowY: 'auto'}}>
                {current?.info.map(e => (
                    <Timeline.Item key={e.time} time={e.time}>
                        {e.content}
                    </Timeline.Item>
                ))}
            </Timeline>
        </Modal>
    </>
}
